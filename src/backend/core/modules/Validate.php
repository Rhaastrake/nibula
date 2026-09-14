<?php

declare(strict_types=1);

class Validate
{
    private const VALIDATION_STATUS = 422;
    private const EMAIL_PATTERN = '/^[^@\s]+@[^@\s]+\.[^@\s]+$/';
    private const INTEGER_PATTERN = '/^\d+$/';

    public static function required(mixed $value, string $field): mixed
    {
        if ($value === null || $value === '') {
            Response::error("The {$field} field is required", self::VALIDATION_STATUS);
        }

        return $value;
    }

    public static function integer(mixed $value, string $field): int
    {
        self::required($value, $field);

        if (!preg_match(self::INTEGER_PATTERN, (string) $value)) {
            Response::error("The {$field} field must be a number", self::VALIDATION_STATUS);
        }

        return (int) $value;
    }

    public static function email(mixed $value, string $field): string
    {
        self::required($value, $field);

        if (!preg_match(self::EMAIL_PATTERN, (string) $value)) {
            Response::error("The {$field} field must be a valid email", self::VALIDATION_STATUS);
        }

        return (string) $value;
    }

    public static function minLength(mixed $value, string $field, int $length): string
    {
        self::required($value, $field);

        if (mb_strlen((string) $value) < $length) {
            Response::error("The {$field} field must be at least {$length} characters", self::VALIDATION_STATUS);
        }

        return (string) $value;
    }
}