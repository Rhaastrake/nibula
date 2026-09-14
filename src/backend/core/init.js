"use strict";

const fs = require("fs");
const path = require("path");

const CONFIG_FILE = "config.js";
const EXAMPLE_CONFIG_FILE = "example.config.js";
const DEFAULT_ENVIRONMENT = "production";

function loadConfig() {
  const backendRoot = path.join(__dirname, "..");
  const configPath = path.join(backendRoot, CONFIG_FILE);

  if (!fs.existsSync(configPath)) {
    throw new Error(
      `Missing ${CONFIG_FILE}. Copy ${EXAMPLE_CONFIG_FILE} to ${CONFIG_FILE} in ${backendRoot} and fill in your values.`,
    );
  }

  return require(configPath);
}

function isDebug(config) {
  return (config.APP_ENV ?? DEFAULT_ENVIRONMENT) !== DEFAULT_ENVIRONMENT;
}

function handleException(exception, config, Response) {
  const debugMode = isDebug(config);

  Response.error(
    debugMode ? exception.message : "Internal server error",
    500,
    debugMode ? { stack: exception.stack } : null,
  );
}

module.exports = { loadConfig, isDebug, handleException };
