<?php

declare(strict_types=1);

class RateLimiter
{
    private const CACHE_FOLDER = '/../../cache';
    private const CACHE_PREFIX = 'rl_';
    private const CACHE_EXTENSION = '.json';
    private const FOLDER_PERMISSIONS = 0755;
    private const TOO_MANY_REQUESTS = 429;

    public static function check(string $ip, int $maxRequests, int $windowSeconds): void
    {
        $cacheDir = __DIR__ . self::CACHE_FOLDER;

        if (!is_dir($cacheDir)) {
            mkdir($cacheDir, self::FOLDER_PERMISSIONS, true);
        }

        $cacheFile = $cacheDir . '/' . self::CACHE_PREFIX . md5($ip) . self::CACHE_EXTENSION;
        $now       = time();
        $timestamps = [];

        if (file_exists($cacheFile)) {
            $timestamps = json_decode(file_get_contents($cacheFile), true) ?: [];
        }

        $timestamps = array_filter($timestamps, fn($timestamp) => $timestamp > ($now - $windowSeconds));
        $timestamps[] = $now;

        file_put_contents($cacheFile, json_encode(array_values($timestamps)), LOCK_EX);

        if (count($timestamps) > $maxRequests) {
            header('Retry-After: ' . $windowSeconds);
            Response::error('Too Many Requests', self::TOO_MANY_REQUESTS);
        }
    }
}