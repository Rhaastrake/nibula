"use strict";

/**
 * Export one function per HTTP method you want to support. Any other method
 * gets an automatic 405, so you never have to check the method yourself.
 *
 * Each function receives the request context:
 *   method         the HTTP method, as a string
 *   requestParams  extra URL segments after the endpoint path
 *   query          query string values: ?page=2 gives { page: '2' }
 *   body           the JSON body, already parsed into an object
 *   rawBody        the body as a raw string, if you need it
 *   headers        the request headers
 *   config         everything from config.js
 *   Response       sends the answer
 *   Validate       checks incoming values
 *
 * Response.success(data, code) and Response.error(message, code) send the
 * answer and stop the request: nothing after them runs.
 */

module.exports = {
  get: ({ requestParams, query, Response }) => {
    Response.success({
      message: "Endpoint is working",
      params: requestParams,
      query: query,
    });
  },

  post: ({ body, Response, Validate }) => {
    // Validate stops the request with a 422 when a value is missing or
    // malformed, so the returned value is always safe to use.
    const name = Validate.required(body.name, "name");
    const email = Validate.email(body.email, "email");

    Response.success({ name, email }, 201);
  },
};
