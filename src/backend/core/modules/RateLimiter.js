"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const CACHE_FOLDER = "cache";
const CACHE_PREFIX = "rl_";
const CACHE_EXTENSION = ".json";
const FOLDER_PERMISSIONS = 0o755;
const TOO_MANY_REQUESTS = 429;
const MILLISECONDS_PER_SECOND = 1000;

function createRateLimiter(Response, res) {
  return {
    check(ip, maxRequests, windowSeconds) {
      const cacheDir = path.join(__dirname, "..", "..", CACHE_FOLDER);

      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true, mode: FOLDER_PERMISSIONS });
      }

      const hash = crypto.createHash("md5").update(ip).digest("hex");
      const cacheFile = path.join(
        cacheDir,
        CACHE_PREFIX + hash + CACHE_EXTENSION,
      );
      const now = Math.floor(Date.now() / MILLISECONDS_PER_SECOND);

      let timestamps = [];

      if (fs.existsSync(cacheFile)) {
        try {
          timestamps = JSON.parse(fs.readFileSync(cacheFile, "utf8")) || [];
        } catch (error) {
          timestamps = [];
        }
      }

      timestamps = timestamps.filter(
        (timestamp) => timestamp > now - windowSeconds,
      );
      timestamps.push(now);

      fs.writeFileSync(cacheFile, JSON.stringify(timestamps));

      if (timestamps.length > maxRequests) {
        res.setHeader("Retry-After", String(windowSeconds));
        Response.error("Too Many Requests", TOO_MANY_REQUESTS);
      }
    },
  };
}

module.exports = { createRateLimiter };
