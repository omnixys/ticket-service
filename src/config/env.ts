/**
 * @license GPL-3.0-or-later
 * Copyright (C) 2025 Caleb Gyamfi - Omnixys Technologies
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * For more information, visit <https://www.gnu.org/licenses/>.
 */

import 'dotenv/config';
import process from 'node:process';

type EnvValue = string | number | boolean;
interface GetEnvOptions<T extends EnvValue = string> {
  required?: boolean;
  transform?: (value: string) => T;
}

function getEnv(
  key: string,
  fallback?: string,
  options?: GetEnvOptions<string>,
): string;
function getEnv<T extends EnvValue>(
  key: string,
  fallback: string,
  options: GetEnvOptions<T> & { transform: (value: string) => T },
): T;
function getEnv(
  key: string,
  fallback?: string,
  options?: GetEnvOptions,
): EnvValue {
  const raw = process.env[key];
  if (!raw) {
    if (options?.required && process.env.NODE_ENV === 'production') {
      throw new Error(`[ENV] Missing required env: ${key}`);
    }
    return options?.transform && fallback !== undefined
      ? options.transform(fallback)
      : (fallback ?? '');
  }
  return options?.transform ? options.transform(raw) : raw;
}

const toBool = (value: string): boolean => value === 'true';
const toNumber = (value: string): number => Number(value);

export const env = {
  NODE_ENV: getEnv('NODE_ENV', 'development'),
  PORT: getEnv('PORT', '4000', { transform: toNumber }),
  SERVICE: getEnv('SERVICE', 'user'),
  TRUSTED_PROXY_ADDRESSES: getEnv('TRUSTED_PROXY_ADDRESSES', ''),

  SCHEMA_TARGET: getEnv('SCHEMA_TARGET', 'true'),
  HTTPS: getEnv('HTTPS', 'false', { transform: toBool }),
  KEYS_PATH: getEnv('KEYS_PATH', './keys'),
  ENABLE_DEV_ENDPOINTS: getEnv('ENABLE_DEV_ENDPOINTS', 'false', {
    transform: toBool,
  }),

  LOG_DEFAULT: getEnv('LOG_DEFAULT', 'false', { transform: toBool }),
  LOG_DIRECTORY: getEnv('LOG_DIRECTORY', 'log'),
  LOG_FILE_DEFAULT_NAME: getEnv('LOG_FILE_DEFAULT_NAME', 'server.log'),
  LOG_PRETTY: getEnv('LOG_PRETTY', 'false', { transform: toBool }),
  LOG_LEVEL: getEnv('LOG_LEVEL', 'info'),
  LOG_BATCH_ENABLE: getEnv('LOG_BATCH_ENABLE', 'true', { transform: toBool }),
  LOG_BATCH_MAX_SIZE: getEnv('LOG_BATCH_MAX_SIZE', '50', {
    transform: toNumber,
  }),
  LOG_BATCH_FLUSH_INTERVAL: getEnv('LOG_BATCH_FLUSH_INTERVAL', '2000', {
    transform: toNumber,
  }),

  OTEL_LOGS_ENABLED: getEnv('OTEL_LOGS_ENABLED', 'true', { transform: toBool }),
  OTEL_URI: getEnv('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://localhost:4318'),
  OTEL_TRANSPORT_MODE: getEnv('OTEL_TRANSPORT_MODE', 'http', {
    required: true,
  }),
  OTEL_SAMPLING_RATIO: getEnv('OTEL_SAMPLING_RATIO', '1', {
    transform: toNumber,
  }),
  TEMPO_URI: getEnv('TEMPO_URI', 'http://localhost:4318'),
  PROMETHEUS_ENABLE: getEnv('PROMETHEUS_ENABLE', 'true', { transform: toBool }),
  PROMETHEUS_PORT: getEnv('PROMETHEUS_PORT', '9464', { transform: toNumber }),

  KAFKA_BROKER: getEnv('KAFKA_BROKER', 'localhost:9092'),
  KAFKA_RETRY: getEnv('KAFKA_RETRY', '5', { transform: toNumber }),
  KAFKA_IDEMPOTENCY_ENABLE: getEnv('KAFKA_IDEMPOTENCY_ENABLE', 'true', {
    transform: toBool,
  }),
  KAFKA_IDEMPOTENCY_TTL: getEnv('KAFKA_IDEMPOTENCY_TTL', '86400', {
    transform: toNumber,
  }),

  VALKEY_URL: getEnv('VALKEY_URL', 'valkey://localhost:6380'),
  VALKEY_PASSWORD: getEnv('VALKEY_PASSWORD', '', { required: true }),

  RATE_LIMIT_ENABLE: getEnv('RATE_LIMIT_ENABLE', 'true', { transform: toBool }),
  RATE_LIMIT_REQUESTS: getEnv('RATE_LIMIT_REQUEST', '100', {
    transform: toNumber,
  }),
  RATE_LIMIT_WINDOW: getEnv('RATE_LIMIT_WINDOW', '60000', {
    transform: toNumber,
  }),

  KC_CLIENT_SECRET: getEnv('KC_CLIENT_SECRET', '', { required: true }),
  KC_URL: getEnv('KC_URL', 'http://localhost:18080/auth'),
  KC_REALM: getEnv('KC_REALM', 'camunda-platform'),
  KC_CLIENT_ID: getEnv('KC_CLIENT_ID', 'camunda-identity'),

  COOKIE_SECRET: getEnv('COOKIE_SECRET', 'omnixys-development-secret', {
    required: true,
  }),
  ENCRYPTION_KEY: getEnv('ENCRYPTION_KEY', '', { required: true }),

  DEFAULT_TENANT_ID: getEnv('DEFAULT_TENANT_ID', ''),

  KEYCLOAK_HEALTH_URL: getEnv('KEYCLOAK_HEALTH_URL', ''),
  TEMPO_HEALTH_URL: getEnv('TEMPO_HEALTH_URL', ''),
  PROMETHEUS_HEALTH_URL: getEnv('PROMETHEUS_HEALTH_URL', ''),

  DATABASE_URL: getEnv('DATABASE_URL', '', { required: true }),

  QR_JWE_KEY: getEnv('QR_JWE_KEY', '', { required: true }),
  QR_JWS_KEYS: getEnv('QR_JWS_KEYS', '', { required: true }),
  QR_ACTIVE_KID: getEnv('QR_ACTIVE_KID', '', { required: true }),
} as const;
