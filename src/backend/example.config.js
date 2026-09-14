"use strict";

/**
 * Template for config.php, which holds the real values and is git-ignored.
 * If config.js is missing, copy this file over it.
 */

module.exports = {

  // Environment: "production" hides error details from anyone calling your API
  // Switch to "debug" while you build to see full error messages
  APP_ENV: "production",

  // Default key for protected endpoints that don't have a specific key in CUSTOM_ENDPOINT_KEYS
  GENERAL_API_KEY: "DEFAULT_KEY",

  // If you want to restrict access to protected endpoints to specific clients, define custom keys per endpoint.
  // For subfolder endpoints, use the relative path ('subfolder/endpoint')
  CUSTOM_ENDPOINT_KEYS: {
    "subfolder/example-protected": "custom-key",
  },

  GENERAL_ALLOWED_ORIGINS: [
    "*",
    // 'https://example.com',
  ],

  CUSTOM_ENDPOINT_ORIGINS: {
    "subfolder/example-protected": ["https://app.example.com"],
  },

  // Database configuration
  DB_HOST: "127.0.0.1",
  DB_NAME: "example_db",
  DB_USER: "root",
  DB_PASS: "",
};
