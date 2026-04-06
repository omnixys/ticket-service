import { PrismaService } from '../prisma/prisma.service.js';
import { TokenService } from '../ticket/service/token.service.js';
import { Injectable } from '@nestjs/common';
import { ValkeyService } from '@omnixys/cache';
import { createSign } from 'crypto';

@Injectable()
export class DevService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly valkey: ValkeyService,
  ) {}

  // ---------------------------------------------------
  // CREATE TICKET (DEV)
  // ---------------------------------------------------
  async createTicket(input: {
    eventId: string;
    invitationId: string;
    guestProfileId: string;
    seatId: string;
  }) {
    return this.prisma.ticket.create({
      data: {
        eventId: input.eventId,
        invitationId: input.invitationId,
        guestProfileId: input.guestProfileId,
        seatId: input.seatId,
        nextNonce: 1,
        currentState: 'OUTSIDE',
      },
    });
  }

  // ---------------------------------------------------
  // Decode token
  // ---------------------------------------------------
  async decodeToken(token: string) {
    return this.tokenService.verify(token);
  }

  // ---------------------------------------------------
  // Sign token
  // ---------------------------------------------------
  async signToken(token: string, deviceId: string, privateKeyBase64: string) {
    const message = `${token}.${deviceId}`;

    const signer = createSign('SHA256');
    signer.update(message);
    signer.end();

    const signature = signer
      .sign({
        key: Buffer.from(privateKeyBase64, 'base64'),
        format: 'der',
        type: 'pkcs8',
      })
      .toString('base64');

    return {
      message,
      signature,
    };
  }

  // ---------------------------------------------------
  // Replay debug
  // ---------------------------------------------------
  async getReplayKeys(ticketId: string) {
    const pattern = `qr:replay:${ticketId}:*`;
    const keys = await this.valkey.client.keys(pattern);

    const values: Record<string, string> = {};

    for (const key of keys) {
      const val = await this.valkey.client.get(key);
      values[key] = val ?? '';
    }

    return values;
  }

  async resetReplay(ticketId: string) {
    const pattern = `qr:replay:${ticketId}:*`;
    const keys = await this.valkey.client.keys(pattern);

    if (keys.length > 0) {
      await this.valkey.client.del(keys);
    }

    return { deleted: keys.length };
  }

  // ---------------------------------------------------
  // Ticket reset
  // ---------------------------------------------------
  async resetTicket(ticketId: string) {
    return this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        lastNonce: null,
        nextNonce: 1,
        currentState: 'OUTSIDE',
        checkedInAt: null,
      },
    });
  }

  // ---------------------------------------------------
  // Debug snapshot
  // ---------------------------------------------------
  async getTicketDebug(ticketId: string) {
    return this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        shareGuard: true,
        scanLogs: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });
  }

  async generateKeyPair() {
    const { generateKeyPairSync } = await import('crypto');

    const { publicKey, privateKey } = generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
    });

    const publicKeyBase64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');

    const privateKeyBase64 = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64');

    return {
      publicKey: publicKeyBase64,
      privateKey: privateKeyBase64,
    };
  }

  async generateSecrets() {
    const { randomBytes } = await import('crypto');

    return {
      jwe: randomBytes(32).toString('base64'),
      jws: randomBytes(32).toString('base64'),
    };
  }
}
