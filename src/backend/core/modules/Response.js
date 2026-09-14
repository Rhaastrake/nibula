"use strict";

const HALT = Symbol("RESPONSE_HALT");

const STATUS_OK = 200;
const STATUS_BAD_REQUEST = 400;
const STATUS_NO_CONTENT = 204;

const JSON_CONTENT_TYPE = "application/json; charset=UTF-8";

function createResponse(res) {
  return {
    success(data = null, code = STATUS_OK) {
      res.statusCode = code;
      res.setHeader("Content-Type", JSON_CONTENT_TYPE);
      res.end(
        JSON.stringify({
          status: "success",
          data: data,
        }),
      );
      throw HALT;
    },

    error(message, code = STATUS_BAD_REQUEST, details = null) {
      res.statusCode = code;
      res.setHeader("Content-Type", JSON_CONTENT_TYPE);

      const body = {
        status: "error",
        message: message,
        code: code,
      };

      if (details !== null) {
        body.details = details;
      }

      res.end(JSON.stringify(body));
      throw HALT;
    },

    noContent() {
      res.statusCode = STATUS_NO_CONTENT;
      res.end();
      throw HALT;
    },
  };
}

module.exports = { createResponse, HALT };
