import { PresenceState, ScanVerdict, Ticket, type Prisma } from '../../prisma/generated/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TicketNotFoundException } from '../errors/ticket-domain.error.js';
import { GateDirection, intendedState } from '../models/enums/gate-direction.enum.js';
import { ScanMessages } from '../utils/scan-messages.js';
import { ShareGuardService } from './shareguard.service.js';
import { QrPayload, TokenService } from './token.service.js';
import { Injectable } from '@nestjs/common';
import { ValkeyKey, ValkeyService } from '@omnixys/cache-ts';
import { n2u } from '@omnixys/contracts-ts';
import { getLogger } from '@omnixys/logger-ts';
import { createHash, createPublicKey, verify } from 'crypto';

const P256_SIGNATURE_LENGTH_BYTES = 64;
const P256_SIGNATURE_ENCODING = 'ieee-p1363';

export interface SignatureVerificationDiagnostics {
  signatureLengthBytes: number;
  signatureFingerprint: string;
  publicKeySpkiLengthBytes: number;
  publicKeyFingerprint: string;
  signedMessageLengthBytes: number;
  verificationEncoding: typeof P256_SIGNATURE_ENCODING;
}

function sha256Fingerprint(value: Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

export function signatureVerificationDiagnostics(
  payload: string,
  signatureBase64: string,
  publicKeyBase64: string,
): SignatureVerificationDiagnostics {
  const signature = Buffer.from(signatureBase64, 'base64');
  const publicKey = Buffer.from(publicKeyBase64, 'base64');
  const message = Buffer.from(payload);

  return {
    signatureLengthBytes: signature.length,
    signatureFingerprint: sha256Fingerprint(signature),
    publicKeySpkiLengthBytes: publicKey.length,
    publicKeyFingerprint: sha256Fingerprint(publicKey),
    signedMessageLengthBytes: message.length,
    verificationEncoding: P256_SIGNATURE_ENCODING,
  };
}

interface ScanVerificationContext {
  actorId?: string;
  gate?: string;
}

interface RejectedScanLogInput {
  ticket: Ticket;
  payload: QrPayload;
  deviceId: string;
  direction: GateDirection;
  context: ScanVerificationContext;
  verdict: ScanVerdict;
  reason: string;
  risk?: ReturnType<ShareGuardService['calculateRisk']>;
  extra?: Record<string, unknown>;
}

function verifySignature(
  payload: string,
  signatureBase64: string,
  publicKeyBase64: string,
): boolean {
  try {
    const publicKey = createPublicKey({
      key: Buffer.from(publicKeyBase64, 'base64'),
      format: 'der',
      type: 'spki',
    });

    return verify(
      'SHA256',
      Buffer.from(payload),
      { key: publicKey, dsaEncoding: P256_SIGNATURE_ENCODING },
      Buffer.from(signatureBase64, 'base64'),
    );
  } catch {
    return false;
  }
}

@Injectable()
export class VerifyService {
  readonly #logger = getLogger(VerifyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly token: TokenService,
    private readonly shareGuard: ShareGuardService,
    private readonly valkey: ValkeyService,
  ) {}

  async verifyToken(
    tokenStr: string,
    signature: string,
    deviceId: string,
    direction: GateDirection,
    database: Prisma.TransactionClient | PrismaService = this.prisma,
    context: ScanVerificationContext = {},
  ): Promise<{ ticket: Ticket; payload: QrPayload; verdict: ScanVerdict; message: string }> {
    const payload = await this.token.verify(tokenStr);

    const ticket = await database.ticket.findUnique({
      where: { id: payload.tid },
    });
    if (!ticket) {
      throw new TicketNotFoundException(payload.tid);
    }

    if (ticket.revoked) {
      const verdict = ScanVerdict.REVOKED;
      this.#logger.warn(
        this.rejectedScanLog({
          ticket,
          payload,
          deviceId,
          direction,
          context,
          verdict,
          reason: 'ticket_revoked',
          extra: { revokedReason: ticket.revokedReason },
        }),
        'verify_ticket_revoked',
      );
      return {
        ticket,
        payload,
        verdict,
        message: n2u(ticket.revokedReason) ?? ScanMessages[verdict],
      };
    }

    if (await this.shareGuard.isBlocked(ticket.id)) {
      this.#logger.warn(
        this.rejectedScanLog({
          ticket,
          payload,
          deviceId,
          direction,
          context,
          verdict: ScanVerdict.BLOCKED,
          reason: 'ticket_blocked',
        }),
        'verify_ticket_blocked',
      );
      return { ticket, payload, verdict: ScanVerdict.BLOCKED, message: ScanMessages.BLOCKED };
    }

    if (!ticket.devicePublicKey) {
      this.#logger.warn(
        this.rejectedScanLog({
          ticket,
          payload,
          deviceId,
          direction,
          context,
          verdict: ScanVerdict.DEVICE_MISMATCH,
          reason: 'missing_device_public_key',
        }),
        'verify_no_public_key',
      );
      return { ticket, payload, verdict: ScanVerdict.DEVICE_MISMATCH, message: 'No Public Key' };
    }

    const message = `${tokenStr}.${deviceId}`;

    if (!verifySignature(message, signature, ticket.devicePublicKey)) {
      const risk = this.shareGuard.calculateRisk({ invalidSignature: true });
      await this.shareGuard.applyDecision(ticket.id, risk);
      this.#logger.warn(
        this.rejectedScanLog({
          ticket,
          payload,
          deviceId,
          direction,
          context,
          verdict: ScanVerdict.DEVICE_MISMATCH,
          reason: 'signature_verification_failed',
          risk,
          extra: {
            ...signatureVerificationDiagnostics(message, signature, ticket.devicePublicKey),
            expectedSignatureLengthBytes: P256_SIGNATURE_LENGTH_BYTES,
          },
        }),
        'verify_signature_invalid',
      );
      return {
        ticket,
        payload,
        verdict: ScanVerdict.DEVICE_MISMATCH,
        message: 'Signature Changed',
      };
    }

    if (ticket.deviceId !== deviceId) {
      const risk = this.shareGuard.calculateRisk({ deviceMismatch: true });
      await this.shareGuard.applyDecision(ticket.id, risk);
      this.#logger.warn(
        this.rejectedScanLog({
          ticket,
          payload,
          deviceId,
          direction,
          context,
          verdict: ScanVerdict.DEVICE_MISMATCH,
          reason: 'device_id_mismatch',
          risk,
        }),
        'verify_device_mismatch',
      );
      return {
        ticket,
        payload,
        verdict: ScanVerdict.DEVICE_MISMATCH,
        message: 'Device Id Changed',
      };
    }

    if (ticket.lastNonce !== null && payload.dn <= ticket.lastNonce) {
      const risk = this.shareGuard.calculateRisk({ replay: true });
      await this.shareGuard.applyDecision(ticket.id, risk);
      this.#logger.warn(
        this.rejectedScanLog({
          ticket,
          payload,
          deviceId,
          direction,
          context,
          verdict: ScanVerdict.REPLAY,
          reason: 'replayed_or_stale_nonce',
          risk,
          extra: { expectedNextNonce: ticket.nextNonce, lastAcceptedNonce: ticket.lastNonce },
        }),
        'verify_replay_detected',
      );
      return {
        ticket,
        payload,
        verdict: ScanVerdict.REPLAY,
        message: ScanMessages.REPLAY,
      };
    }

    if (payload.dn !== ticket.nextNonce) {
      const risk = this.shareGuard.calculateRisk({ invalidNonce: true });
      await this.shareGuard.applyDecision(ticket.id, risk);
      this.#logger.warn(
        this.rejectedScanLog({
          ticket,
          payload,
          deviceId,
          direction,
          context,
          verdict: ScanVerdict.INVALID_NONCE,
          reason: 'unexpected_nonce',
          risk,
          extra: { expectedNextNonce: ticket.nextNonce, lastAcceptedNonce: ticket.lastNonce },
        }),
        'verify_invalid_nonce',
      );
      return {
        ticket,
        payload,
        verdict: ScanVerdict.INVALID_NONCE,
        message: ScanMessages.INVALID_NONCE,
      };
    }

    // ---------------------------------------------------------------
    // Gate direction policy (after all security checks have passed).
    // Policy rejections do NOT consume the nonce (the holder must be
    // able to scan again at the correct gate without a replay error)
    // and do NOT raise share-guard risk.
    // ---------------------------------------------------------------
    const intended = intendedState(direction);

    if (ticket.currentState === intended) {
      const verdict =
        intended === PresenceState.INSIDE ? ScanVerdict.ALREADY_INSIDE : ScanVerdict.NOT_INSIDE;
      this.#logger.warn(
        this.rejectedScanLog({
          ticket,
          payload,
          deviceId,
          direction,
          context,
          verdict,
          reason: 'direction_policy_rejected',
          extra: { intendedState: intended },
        }),
        'verify_direction_rejected',
      );
      return { ticket, payload, verdict, message: ScanMessages[verdict] };
    }

    if (direction === GateDirection.ENTRY) {
      const eventSettingsProjection = database.eventSettingsProjection;
      const eventSettings = eventSettingsProjection
        ? await eventSettingsProjection.findUnique({
            where: { eventId: ticket.eventId },
            select: { endsAt: true },
          })
        : null;
      if (eventSettings?.endsAt && eventSettings.endsAt.getTime() < Date.now()) {
        this.#logger.warn(
          this.rejectedScanLog({
            ticket,
            payload,
            deviceId,
            direction,
            context,
            verdict: ScanVerdict.EXPIRED_EVENT,
            reason: 'event_ended',
            extra: { eventEndsAt: eventSettings.endsAt.toISOString() },
          }),
          'verify_event_expired',
        );
        return {
          ticket,
          payload,
          verdict: ScanVerdict.EXPIRED_EVENT,
          message: ScanMessages.EXPIRED_EVENT,
        };
      }
    }

    const replayKey = ValkeyKey.qrReply.key(ticket.id, payload.dn);
    const acquired = await this.valkey.rawSetIfAbsent(replayKey, '1', 120);
    if (!acquired) {
      const risk = this.shareGuard.calculateRisk({ replay: true });
      await this.shareGuard.applyDecision(ticket.id, risk);
      this.#logger.warn(
        this.rejectedScanLog({
          ticket,
          payload,
          deviceId,
          direction,
          context,
          verdict: ScanVerdict.REPLAY,
          reason: 'replay_cache_already_present',
          risk,
        }),
        'verify_replay_cache_detected',
      );

      return { ticket, payload, verdict: ScanVerdict.REPLAY, message: ScanMessages.REPLAY };
    }

    await this.shareGuard.resetShareGuard(ticket.id);

    const state = intended;
    const checkedInAt = state === PresenceState.INSIDE ? new Date() : ticket.checkedInAt;
    const updated = await database.ticket.updateMany({
      where: {
        id: ticket.id,
        nextNonce: payload.dn,
      },
      data: {
        currentState: state,
        lastNonce: payload.dn,
        nextNonce: payload.dn + 1,
        checkedInAt,
      },
    });

    if (updated.count === 0) {
      this.#logger.warn(
        this.rejectedScanLog({
          ticket,
          payload,
          deviceId,
          direction,
          context,
          verdict: ScanVerdict.REPLAY,
          reason: 'nonce_update_race_condition',
          extra: { expectedNextNonce: ticket.nextNonce },
        }),
        'verify_nonce_race_condition',
      );
      return {
        ticket,
        payload,
        verdict: ScanVerdict.REPLAY,
        message: 'Nonce race condition detected',
      };
    }

    this.#logger.debug(
      { ticketId: ticket.id, newState: state, nonce: payload.dn },
      'verify_success',
    );

    return {
      ticket: {
        ...ticket,
        currentState: state,
        lastNonce: payload.dn,
        nextNonce: payload.dn + 1,
        checkedInAt,
        updatedAt: new Date(),
      },
      payload,
      verdict: ScanVerdict.OK,
      message: ScanMessages.OK,
    };
  }

  private rejectedScanLog({
    ticket,
    payload,
    deviceId,
    direction,
    context,
    verdict,
    reason,
    risk,
    extra = {},
  }: RejectedScanLogInput): Record<string, unknown> {
    return {
      ticketId: ticket.id,
      eventId: ticket.eventId,
      guestProfileId: ticket.guestProfileId,
      seatId: ticket.seatId,
      scannerActorId: context.actorId,
      gate: context.gate,
      direction,
      ticketCurrentState: ticket.currentState,
      ticketDeviceActivationAt: ticket.deviceActivationAt?.toISOString(),
      expectedDeviceId: ticket.deviceId,
      receivedDeviceId: deviceId,
      qrNonce: payload.dn,
      qrIssuedAt: payload.ts,
      qrKeyId: payload.kid,
      verdict,
      rejectionReason: reason,
      shareGuardRisk: risk,
      ...extra,
    };
  }
}
