"use strict";

const VALIDATION_STATUS = 422;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const INTEGER_PATTERN = /^\d+$/;

function createValidator(Response) {
  const validator = {
    required(value, field) {
      if (value === undefined || value === null || value === "") {
        Response.error(`The ${field} field is required`, VALIDATION_STATUS);
      }
      return value;
    },

    integer(value, field) {
      validator.required(value, field);

      if (!INTEGER_PATTERN.test(String(value))) {
        Response.error(
          `The ${field} field must be a number`,
          VALIDATION_STATUS,
        );
      }
      return Number(value);
    },

    email(value, field) {
      validator.required(value, field);

      if (!EMAIL_PATTERN.test(String(value))) {
        Response.error(
          `The ${field} field must be a valid email`,
          VALIDATION_STATUS,
        );
      }
      return String(value);
    },

    minLength(value, field, length) {
      validator.required(value, field);

      if (String(value).length < length) {
        Response.error(
          `The ${field} field must be at least ${length} characters`,
          VALIDATION_STATUS,
        );
      }
      return String(value);
    },
  };

  return validator;
}

module.exports = { createValidator };
