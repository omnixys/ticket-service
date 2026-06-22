import type { ScanVerdict } from '../../prisma/generated/client.js';

export const ScanMessages: Record<ScanVerdict, string> = {
  OK: 'Access granted',
  REVOKED: 'Ticket is no longer valid',
  BLOCKED: 'Too many attempts. Please wait',
  DEVICE_MISMATCH: 'Invalid device',
  INVALID_NONCE: 'Invalid scan',
  REPLAY: 'Scan already used',
  UNKNOWN: 'Unknown',
  EXPIRED_EVENT: 'Event Expired',

  // DEVICE_NOT_ACTIVATED: 'Device not registered',

  // ERROR: 'Scan failed',
} as const satisfies Record<ScanVerdict, string>;

export const ScanDebugMessages: Record<string, string> = {
  INVALID_SIGNATURE: 'Signature verification failed',
  DEVICE_ID_MISMATCH: 'Device ID mismatch',
  NONCE_INVALID: 'Nonce mismatch',
  NONCE_REPLAY: 'Replay detected',
  REDIS_REPLAY: 'Redis replay hit',
};
