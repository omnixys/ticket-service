import { TicketTokenInvalidException } from '../errors/ticket-domain.error.js';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { getLogger } from '@omnixys/logger';
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import * as jose from 'jose';

export interface QrPayload {
  tid: string;
  eid: string;
  gid: string;
  sid: string;
  dn: number;
  ts: number;
  dh?: string;
  kid?: string;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === 'string')
  );
}

@Injectable()
export class TokenService {
  readonly #logger = getLogger(TokenService.name);
  private readonly encKey: Uint8Array;
  private readonly signKeys: Map<string, Uint8Array>;
  private readonly activeKid: string;

  constructor() {
    // ---------------------------------------------------
    // ENCRYPTION KEY (STRICT)
    // ---------------------------------------------------
    const enc = process.env.QR_JWE_KEY;
    if (!enc) {
      throw new InternalServerErrorException('QR_JWE_KEY not configured');
    }

    this.encKey = this.parseKey(enc);

    if (this.encKey.length !== 32) {
      throw new InternalServerErrorException('QR_JWE_KEY must be 32 bytes (base64)');
    }

    // ---------------------------------------------------
    // SIGNING KEYS (STRICT)
    // ---------------------------------------------------
    const rawKeys = process.env.QR_JWS_KEYS;
    if (!rawKeys) {
      throw new InternalServerErrorException('QR_JWS_KEYS not configured');
    }

    let parsed: Record<string, string>;
    try {
      const parsedJson: unknown = JSON.parse(rawKeys);
      if (!isStringRecord(parsedJson)) {
        throw new Error('Invalid key map');
      }
      parsed = parsedJson;
    } catch {
      throw new InternalServerErrorException('QR_JWS_KEYS must be valid JSON');
    }

    this.signKeys = new Map();

    for (const [kid, val] of Object.entries(parsed)) {
      const key = this.parseKey(val);
      if (key.length < 32) {
        throw new InternalServerErrorException(`Key ${kid} too short`);
      }
      this.signKeys.set(kid, key);
    }

    this.activeKid = process.env.QR_ACTIVE_KID ?? 'v1';

    if (!this.signKeys.has(this.activeKid)) {
      throw new InternalServerErrorException(`Active KID ${this.activeKid} not found`);
    }
  }

  // ---------------------------------------------------
  // SAFE KEY PARSER
  // ---------------------------------------------------
  private parseKey(value: string): Uint8Array {
    try {
      return Buffer.from(value, 'base64');
    } catch {
      throw new InternalServerErrorException('Invalid key format');
    }
  }

  // ---------------------------------------------------
  // DEVICE HASH (TIMING SAFE)
  // ---------------------------------------------------
  hashDevice(deviceId: string): string {
    return createHash('sha256').update(deviceId).digest('hex');
  }

  verifyDeviceHash(deviceId: string, dh?: string): boolean {
    if (!dh) {
      return true;
    }

    const expected = Buffer.from(this.hashDevice(deviceId));
    const actual = Buffer.from(dh);

    if (expected.length !== actual.length) {
      return false;
    }

    return timingSafeEqual(expected, actual);
  }

  generateDeviceId(): string {
    return randomUUID();
  }

  // ---------------------------------------------------
  // GENERATE TOKEN (JWS → JWE)
  // ---------------------------------------------------
  async generate(payload: QrPayload): Promise<string> {
    const key = this.signKeys.get(this.activeKid);
    if (!key) {
      throw new InternalServerErrorException('Signing key missing');
    }

    const enriched: jose.JWTPayload & QrPayload = {
      ...payload,
      ts: Date.now(),
      kid: this.activeKid,
    };

    const jws = await new jose.SignJWT(enriched)
      .setProtectedHeader({
        alg: 'HS256',
        kid: this.activeKid,
        typ: 'JWT',
      })
      .setIssuedAt()
      .setExpirationTime('60s')
      .sign(key);

    return new jose.CompactEncrypt(new TextEncoder().encode(jws))
      .setProtectedHeader({
        alg: 'dir',
        enc: 'A256GCM',
      })
      .encrypt(this.encKey);
  }

  // ---------------------------------------------------
  // VERIFY TOKEN
  // ---------------------------------------------------
  async verify(token: string): Promise<QrPayload> {
    try {
      // JWE decrypt
      const { plaintext } = await jose.compactDecrypt(token, this.encKey);

      const jws = new TextDecoder().decode(plaintext);

      // Extract header safely
      const header = jose.decodeProtectedHeader(jws);

      if (!header.kid) {
        throw new TypeError('Missing KID');
      }

      const key = this.signKeys.get(header.kid);
      if (!key) {
        this.#logger.warn({ kid: header.kid }, 'token_verify_unknown_kid');
        throw new TypeError('Unknown KID');
      }

      // Verify JWS
      const { payload } = await jose.jwtVerify(jws, key, {
        algorithms: ['HS256'],
      });

      this.#logger.debug(
        {
          ticketId: (payload as unknown as QrPayload).tid,
          nonce: (payload as unknown as QrPayload).dn,
        },
        'token_verify_success',
      );
      return payload as unknown as QrPayload;
    } catch (cause) {
      this.#logger.warn(
        { error: cause instanceof Error ? cause.message : String(cause) },
        'token_verify_failed',
      );
      throw new TicketTokenInvalidException(cause);
    }
  }
}
