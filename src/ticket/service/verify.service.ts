
import { PresenceState, ScanVerdict, Ticket } from '../../prisma/generated/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ScanMessages } from '../utils/scan-messages.js';
import { ShareGuardService } from './shareguard.service.js';
import { TokenService } from './token.service.js';
import { Injectable } from '@nestjs/common';
import { ValkeyKey, ValkeyService } from '@omnixys/cache';
import { n2u } from '@omnixys/shared';
import { createVerify } from 'crypto';

function verifySignature(
  payload: string,
  signatureBase64: string,
  publicKeyBase64: string,
): boolean {
  try {
    const verifier = createVerify('SHA256');
    verifier.update(payload);
    verifier.end();

    return verifier.verify(
      {
        key: Buffer.from(publicKeyBase64, 'base64'),
        format: 'der',
        type: 'spki',
      },
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
  ): Promise<{ ticket: Ticket; payload: any; verdict: ScanVerdict, message: string }> {
    const payload = await this.token.verify(tokenStr);

    const ticket = await this.prisma.ticket.findUniqueOrThrow({
      where: { id: payload.tid },
    });

    if (ticket.revoked) {
      const verdict = ScanVerdict.REVOKED;
      return {
        ticket,
        payload,
        verdict,
        message: n2u(ticket.revokedReason) ?? ScanMessages[verdict],
      };
    }

    if (await this.shareGuard.isBlocked(ticket.id))
      return { ticket, payload, verdict: ScanVerdict.BLOCKED, message: ScanMessages.BLOCKED};

    if (!ticket.devicePublicKey)
      return { ticket, payload, verdict: ScanVerdict.DEVICE_MISMATCH, message: 'No Public Key' };

    // const message = `${tokenStr}.${deviceId}.${payload.ts}`;
    //const message = `${tokenStr}.${deviceId}.${payload.ts}.${payload.dn}`;
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

    if (ticket.lastNonce !== null && payload.dn <= ticket.lastNonce) {
      await this.shareGuard.applyDecision(
        ticket.id,
        this.shareGuard.calculateRisk({ replay: true }),
      );

      return { ticket, payload, verdict: ScanVerdict.REPLAY, message: ScanMessages.REPLAY };
    }

    const replayKey = `qr:replay:${ticket.id}:${payload.dn}`;
    // const ok = await this.valkey.set(replayKey, '1', { NX: true, EX: 120 });
    // const ok = await this.valkey.set(ValkeyKey.qrReply, replayKey, 120);

    // const ok = await this.valkey.setNx(ValkeyKey.qrReply, replayKey, 120);

    // if (!ok) {
    //   await this.shareGuard.applyDecision(
    //     ticket.id,
    //     this.shareGuard.calculateRisk({ replay: true }),
    //   );

    //   return { ticket, payload, verdict: ScanVerdict.REPLAY };
    // }

    const existing = await this.valkey.get(ValkeyKey.qrReply, replayKey);
    if (existing) {
      await this.shareGuard.applyDecision(
        ticket.id,
        this.shareGuard.calculateRisk({ replay: true }),
      );

      return { ticket, payload, verdict: ScanVerdict.REPLAY, message: ScanMessages.REPLAY };
    }

    await this.valkey.set(ValkeyKey.qrReply, replayKey, 120);

    await this.shareGuard.resetShareGuard(ticket.id);

    const state =
            ticket.currentState === PresenceState.OUTSIDE
              ? PresenceState.INSIDE
              : PresenceState.OUTSIDE;
    
    const updated = await this.prisma.ticket.updateMany({
      where: {
        id: ticket.id,
        nextNonce: payload.dn, 
      },
      data: {
        currentState: state,
        lastNonce: payload.dn,
        nextNonce: payload.dn + 1,
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

    return { ticket, payload, verdict: ScanVerdict.OK, message: ScanMessages.OK };
  }
}
