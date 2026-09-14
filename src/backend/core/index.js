"use strict";

const DEBUG_HEADER = "Debug-Mode";
const DEBUG_HEADER_VALUE = "true";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { createResponse, HALT } = require("./modules/Response");
const { createValidator } = require("./modules/Validate");
const { createRateLimiter } = require("./modules/RateLimiter");
const { loadConfig, isDebug, handleException } = require("./init");

const CORE_PATH = __dirname;

const URL_PREFIX = "/api";
const ENDPOINT_EXTENSION = ".js";
const ERROR_PAGE = "404.html";
const ENDPOINTS_FOLDER = "endpoints";
const PUBLIC_FOLDER = "public";
const PROTECTED_FOLDER = "protected";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = "3000";
const RATE_LIMIT_REQUESTS = 60;
const RATE_LIMIT_WINDOW_SECONDS = 60;

const STATUS_NO_CONTENT = 204;
const STATUS_BAD_REQUEST = 400;
const STATUS_UNAUTHORIZED = 401;
const STATUS_NOT_FOUND = 404;
const STATUS_METHOD_NOT_ALLOWED = 405;
const STATUS_SERVER_ERROR = 500;

const ALLOWED_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
const ALLOWED_HEADERS = "Content-Type, X-Api-Key";
const JSON_CONTENT_TYPE = "application/json; charset=UTF-8";
const HTML_CONTENT_TYPE = "text/html; charset=UTF-8";

const config = loadConfig();
const debugMode = isDebug(config);

const DOCUMENT_ROOT =
  process.env.DOCUMENT_ROOT || path.join(CORE_PATH, "..", "..");
const basePublic = path.join(CORE_PATH, "..", ENDPOINTS_FOLDER, PUBLIC_FOLDER);
const baseProtected = path.join(
  CORE_PATH,
  "..",
  ENDPOINTS_FOLDER,
  PROTECTED_FOLDER,
);

function hashEquals(known, given) {
  const knownBuffer = Buffer.from(String(known));
  const givenBuffer = Buffer.from(String(given));

  if (knownBuffer.length !== givenBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(knownBuffer, givenBuffer);
}

function sendErrorPage(res) {
  const errorPage = path.join(DOCUMENT_ROOT, ERROR_PAGE);

  res.statusCode = STATUS_NOT_FOUND;
  res.setHeader("Content-Type", HTML_CONTENT_TYPE);
  res.end(
    fs.existsSync(errorPage)
      ? fs.readFileSync(errorPage)
      : "<h1>404 Not Found</h1>The requested URL was not found on this server.",
  );
}

function parseSegments(pathname) {
  const uri = pathname
    .replace(new RegExp(`^${URL_PREFIX}`), "")
    .replace(/\/+$/, "");

  return uri.split("/").filter((segment) => segment !== "");
}

function resolveEndpoint(segments) {
  const remaining = segments.slice();
  const params = [];

  while (remaining.length > 0) {
    const relativePath = remaining.join("/") + ENDPOINT_EXTENSION;

    const publicCandidate = path.join(basePublic, relativePath);
    if (fs.existsSync(publicCandidate)) {
      return {
        file: publicCandidate,
        base: basePublic,
        isProtected: false,
        params,
      };
    }

    const protectedCandidate = path.join(baseProtected, relativePath);
    if (fs.existsSync(protectedCandidate)) {
      return {
        file: protectedCandidate,
        base: baseProtected,
        isProtected: true,
        params,
      };
    }

    params.unshift(remaining.pop());
  }

  return null;
}

function toEndpointKey(file, base) {
  return file
    .split(path.sep)
    .join("/")
    .replace(base.split(path.sep).join("/"), "")
    .replace(new RegExp(`\\${ENDPOINT_EXTENSION}$`), "")
    .replace(/^\//, "");
}

function applySecurityHeaders(res) {
  res.setHeader("Content-Type", JSON_CONTENT_TYPE);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Access-Control-Allow-Methods", ALLOWED_METHODS);
  res.setHeader("Access-Control-Allow-Headers", ALLOWED_HEADERS);

  if (debugMode) {
    res.setHeader(DEBUG_HEADER, DEBUG_HEADER_VALUE);
  }
}

function applyCors(res, endpointKey, origin) {
  const allowedOrigins =
    config.CUSTOM_ENDPOINT_ORIGINS?.[endpointKey] ??
    config.GENERAL_ALLOWED_ORIGINS ??
    [];

  if (origin !== "" && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");

    return;
  }

  if (allowedOrigins.includes("*")) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
}

function authorize(endpointKey, givenKey, Response) {
  const validKey =
    config.CUSTOM_ENDPOINT_KEYS?.[endpointKey] ?? config.GENERAL_API_KEY ?? "";

  if (validKey === "" || !hashEquals(validKey, givenKey)) {
    Response.error(
      "Unauthorized. X-Api-Key is incorrect or missing",
      STATUS_UNAUTHORIZED,
    );
  }
}

function clientAddress(req) {
  const forwarded = (req.headers["x-forwarded-for"] || "").split(",")[0].trim();

  return forwarded || req.socket.remoteAddress || "";
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];

    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      let json = {};

      try {
        json = raw ? JSON.parse(raw) : {};
      } catch (error) {
        json = {};
      }

      resolve({ raw, json });
    });
    req.on("error", () => resolve({ raw: "", json: {} }));
  });
}

function loadHandlers(file) {
  if (debugMode) {
    delete require.cache[require.resolve(file)];
  }

  return require(file);
}

async function dispatch(file, context, Response) {
  const handlers = loadHandlers(file);

  if (typeof handlers === "function") {
    await handlers(context);

    return;
  }

  const methodHandler = handlers[context.method.toLowerCase()];

  if (typeof methodHandler !== "function") {
    Response.error("Method not allowed", STATUS_METHOD_NOT_ALLOWED);
  }

  await methodHandler(context);
}

async function handleRequest(req, res) {
  const Response = createResponse(res);

  try {
    const parsedUrl = new URL(req.url, `http://${DEFAULT_HOST}`);
    const segments = parseSegments(parsedUrl.pathname);

    if (segments.some((segment) => segment === "." || segment === "..")) {
      Response.error("Bad Request", STATUS_BAD_REQUEST);
    }

    const endpoint = resolveEndpoint(segments);

    if (endpoint === null) {
      sendErrorPage(res);

      return;
    }

    const endpointKey = toEndpointKey(endpoint.file, endpoint.base);

    applySecurityHeaders(res);
    applyCors(res, endpointKey, req.headers.origin || "");

    if (req.method === "OPTIONS") {
      res.statusCode = STATUS_NO_CONTENT;
      res.end();

      return;
    }

    createRateLimiter(Response, res).check(
      clientAddress(req),
      RATE_LIMIT_REQUESTS,
      RATE_LIMIT_WINDOW_SECONDS,
    );

    if (endpoint.isProtected) {
      authorize(endpointKey, req.headers["x-api-key"] || "", Response);
    }

    const body = await readBody(req);

    await dispatch(
      endpoint.file,
      {
        method: req.method,
        requestParams: endpoint.params,
        query: Object.fromEntries(parsedUrl.searchParams),
        body: body.json,
        rawBody: body.raw,
        headers: req.headers,
        Response,
        Validate: createValidator(Response),
        config,
        CORE_PATH,
        req,
        res,
      },
      Response,
    );

    if (!res.writableEnded) {
      res.end();
    }
  } catch (error) {
    if (error === HALT) {
      return;
    }

    try {
      handleException(error, config, Response);
    } catch (inner) {
      if (inner === HALT) {
        return;
      }

      if (!res.writableEnded) {
        res.statusCode = STATUS_SERVER_ERROR;
        res.end(
          JSON.stringify({
            status: "error",
            message: "Internal server error",
            code: STATUS_SERVER_ERROR,
          }),
        );
      }
    }
  }
}

const host = process.env.HOST || DEFAULT_HOST;
const port = parseInt(process.env.PORT || DEFAULT_PORT, 10);

const server = http.createServer(handleRequest);

server.listen(port, host, () => {
  console.log(`Backend started listening on http://${host}:${port}`);
  if (debugMode) {
    console.log(
      'WARNING: error details are exposed in responses. Set APP_ENV to "production" in config.js before publishing.',
    );
  }
});

module.exports = server;
