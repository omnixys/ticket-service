import { PresenceState, ScanVerdict, Ticket } from '../../prisma/generated/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TicketNotFoundException } from '../errors/ticket-domain.error.js';
import { ScanMessages } from '../utils/scan-messages.js';
import { ShareGuardService } from './shareguard.service.js';
import { QrPayload, TokenService } from './token.service.js';
import { Injectable } from '@nestjs/common';
import { ValkeyKey, ValkeyService } from '@omnixys/cache';
import { n2u } from '@omnixys/contracts';
import { createPublicKey, verify } from 'crypto';

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
      publicKey,
      Buffer.from(signatureBase64, 'base64'),
    );
  } catch {
    return false;
  }
}

@Injectable()
export class VerifyService {
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
  ): Promise<{ ticket: Ticket; payload: QrPayload; verdict: ScanVerdict; message: string }> {
    const payload = await this.token.verify(tokenStr);

    const ticket = await this.prisma.ticket.findUnique({
      where: { id: payload.tid },
    });
    if (!ticket) {
      throw new TicketNotFoundException(payload.tid);
    }

    if (ticket.revoked) {
      const verdict = ScanVerdict.REVOKED;
      return {
        ticket,
        payload,
        verdict,
        message: n2u(ticket.revokedReason) ?? ScanMessages[verdict],
      };
    }

    if (await this.shareGuard.isBlocked(ticket.id)) {
      return { ticket, payload, verdict: ScanVerdict.BLOCKED, message: ScanMessages.BLOCKED };
    }

    if (!ticket.devicePublicKey) {
      return { ticket, payload, verdict: ScanVerdict.DEVICE_MISMATCH, message: 'No Public Key' };
    }

    const message = `${tokenStr}.${deviceId}`;

    if (!verifySignature(message, signature, ticket.devicePublicKey)) {
      await this.shareGuard.applyDecision(
        ticket.id,
        this.shareGuard.calculateRisk({ invalidSignature: true }),
      );
      return {
        ticket,
        payload,
        verdict: ScanVerdict.DEVICE_MISMATCH,
        message: 'Signature Changed',
      };
    }

    if (ticket.deviceId !== deviceId) {
      await this.shareGuard.applyDecision(
        ticket.id,
        this.shareGuard.calculateRisk({ deviceMismatch: true }),
      );
      return {
        ticket,
        payload,
        verdict: ScanVerdict.DEVICE_MISMATCH,
        message: 'Device Id Changed',
      };
    }

    if (ticket.lastNonce !== null && payload.dn <= ticket.lastNonce) {
      await this.shareGuard.applyDecision(
        ticket.id,
        this.shareGuard.calculateRisk({ replay: true }),
      );

      return {
        ticket,
        payload,
        verdict: ScanVerdict.REPLAY,
        message: ScanMessages.REPLAY,
      };
    }

    if (payload.dn !== ticket.nextNonce) {
      await this.shareGuard.applyDecision(
        ticket.id,
        this.shareGuard.calculateRisk({ invalidNonce: true }),
      );
      return {
        ticket,
        payload,
        verdict: ScanVerdict.INVALID_NONCE,
        message: ScanMessages.INVALID_NONCE,
      };
    }

    const replayKey = ValkeyKey.qrReply.key(ticket.id, payload.dn);
    const acquired = await this.valkey.rawSetIfAbsent(replayKey, '1', 120);
    if (!acquired) {
      await this.shareGuard.applyDecision(
        ticket.id,
        this.shareGuard.calculateRisk({ replay: true }),
      );

      return { ticket, payload, verdict: ScanVerdict.REPLAY, message: ScanMessages.REPLAY };
    }

    await this.shareGuard.resetShareGuard(ticket.id);

    const state =
      ticket.currentState === PresenceState.OUTSIDE ? PresenceState.INSIDE : PresenceState.OUTSIDE;

    const checkedInAt = state === PresenceState.INSIDE ? new Date() : ticket.checkedInAt;
    const updated = await this.prisma.ticket.updateMany({
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
      return {
        ticket,
        payload,
        verdict: ScanVerdict.REPLAY,
        message: 'Nonce race condition detected',
      };
    }

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
}
