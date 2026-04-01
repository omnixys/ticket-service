/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
// /* eslint-disable @typescript-eslint/no-explicit-any */
// /* eslint-disable @typescript-eslint/explicit-function-return-type */
// // TODO resolve eslint
// /* eslint-disable @typescript-eslint/no-unused-vars */
// /* eslint-disable @typescript-eslint/no-unsafe-assignment */
// /* eslint-disable @typescript-eslint/no-unsafe-member-access */
// /* eslint-disable @typescript-eslint/no-unsafe-call */
// /* eslint-disable @typescript-eslint/no-unsafe-return */
// src/ticket/service/ticket-write.service.ts

/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateTicketDTO } from '../models/dto/create-ticket.dto.js';
import { ShareGuard } from '../models/entities/share-guard.entity.js';
import { Ticket } from '../models/entities/ticket.entity.js';
import { PresenceState } from '../models/enums/presence-state.enum.js';
import { ScanVerdict } from '../models/enums/scan-verdict.enum.js';
import { VerifyTokenInput } from '../models/inputs/verify-token.input.js';
import { mapScanLog } from '../models/mapper/scan-logs.mapper.js';
import { mapTicket } from '../models/mapper/ticket.mapper.js';
import { VerifyPayload } from '../models/payloads/verify.payload.js';
import { GenerateTokenInput, TogglePresence } from '../resolvers/ticket-mutation.resolver.js';
import {
  decodeWithoutDots,
  generateWithoutDots,
  TicketTokenPayload,
} from '../utils/token.service.js';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OmnixysLogger } from '@omnixys/logger';

export interface UpdateTicketInput {
  id: string;
  revoked?: boolean;
  currentState?: PresenceState;
  seatId?: string | null;
}

@Injectable()
export class TicketWriteService {
  private readonly logger;

  constructor(
    private readonly prisma: PrismaService,
    private readonly loggerService: OmnixysLogger,
  ) {
    this.logger = this.loggerService.log(this.constructor.name);
  }

  // -------------------------------------------------------------
  // 1) Create a ticket after Invitation is approved
  // -------------------------------------------------------------
  async createTicket(data: CreateTicketDTO): Promise<Ticket> {
    const existing = await this.prisma.ticket.findUnique({
      where: { invitationId: data.invitationId },
    });

    if (existing) {
      throw new BadRequestException('Ticket already exists for this invitation');
    }

    const created = await this.prisma.ticket.create({
      data: {
        eventId: data.eventId,
        invitationId: data.invitationId,
        guestProfileId: data.guestProfileId ?? null,
        seatId: data.seatId ?? null,
      },
    });

    return mapTicket(created);
  }

  // -------------------------------------------------------------
  // 2) Bind a device to a ticket ("device activation")
  // -------------------------------------------------------------
  async activateDevice(
    ticketId: string,
    payload: {
      deviceHash: string;
      devicePublicKey: string;
      ip?: string | null;
    },
  ): Promise<Ticket> {
    this.logger.debug('');
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // Already bound but mismatch → block
    if (ticket.deviceHash && ticket.deviceHash !== payload.deviceHash) {
      throw new BadRequestException('Device mismatch – ticket already bound');
    }

    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        deviceHash: payload.deviceHash,
        devicePublicKey: payload.devicePublicKey,
        deviceActivationIP: payload.ip ?? null,
        deviceActivationAt: new Date(),
      },
    });

    return mapTicket(updated);
  }

  // -------------------------------------------------------------
  // 3) Rotate Nonce (for rotating QR-Tokens)
  // -------------------------------------------------------------
  async rotateNonce(ticketId: string): Promise<Ticket> {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const nextNonce = (ticket.nextNonce ?? ticket.lastNonce ?? 0) + 1;
    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        lastNonce: ticket.nextNonce ?? null,
        nextNonce,
        lastRotatedAt: new Date(),
      },
    });

    return mapTicket(updated);
  }

  // -------------------------------------------------------------
  // 4) Revoke ticket (security or admin)
  // -------------------------------------------------------------
  async revoke(ticketId: string, reason?: string): Promise<Ticket> {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { revoked: true },
    });

    // optional: write ScanLog "REVOKED"
    await this.prisma.scanLog.create({
      data: {
        ticketId,
        eventId: ticket.eventId,
        direction: PresenceState.OUTSIDE,
        verdict: ScanVerdict.REVOKED,
        reason: reason ?? 'Manual revoke',
      } as any,
    });

    return mapTicket(updated);
  }

  // -------------------------------------------------------------
  // 5) Toggle IN/OUT at gate (Security scanning)
  // -------------------------------------------------------------
  async togglePresence(
    ticketId: string,
    byUserId?: string,
    gate?: string | null,
  ): Promise<TogglePresence> {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const nextState =
      (ticket.currentState as PresenceState) === PresenceState.INSIDE
        ? PresenceState.OUTSIDE
        : PresenceState.INSIDE;

    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { currentState: nextState },
    });

    const log = await this.prisma.scanLog.create({
      data: {
        ticketId,
        eventId: ticket.eventId,
        direction: nextState,
        gate: gate ?? null,
        byUserId: byUserId ?? null,
        verdict: ScanVerdict.OK,
        deviceHash: ticket.deviceHash ?? null,
        nonce: ticket.lastNonce ?? null,
      },
    });

    return {
      ticket: mapTicket(updated),
      log: mapScanLog(log),
    };
  }

  // -------------------------------------------------------------
  // 6) Full security scan including Nonce & Device checks
  // -------------------------------------------------------------
  async securityScan(data: {
    ticketId: string;
    nonce: number;
    deviceHash?: string | null;
    byUserId?: string | null;
    gate?: string | null;
  }): Promise<TogglePresence> {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: data.ticketId } });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    let verdict: ScanVerdict = ScanVerdict.OK;

    // 1) Ticket revoked?
    if (ticket.revoked) {
      verdict = ScanVerdict.REVOKED;
    }

    // 2) Device mismatch?
    if (ticket.deviceHash && data.deviceHash && ticket.deviceHash !== data.deviceHash) {
      verdict = ScanVerdict.DEVICE_MISMATCH;
    }

    // 3) Nonce check (Replay)
    if (ticket.lastNonce !== null && data.nonce <= (ticket.lastNonce ?? 0)) {
      verdict = ScanVerdict.REPLAY;
    }

    // 4) Nonce invalid?
    if (ticket.nextNonce !== null && data.nonce !== ticket.nextNonce) {
      verdict = ScanVerdict.INVALID_NONCE;
    }

    // --- Write ScanLog ---
    const logRow = await this.prisma.scanLog.create({
      data: {
        ticketId: ticket.id,
        eventId: ticket.eventId,
        byUserId: data.byUserId ?? null,
        gate: data.gate ?? null,
        direction: verdict === ScanVerdict.OK ? PresenceState.INSIDE : PresenceState.OUTSIDE,
        verdict,
        nonce: data.nonce,
        deviceHash: data.deviceHash ?? null,
      },
    });

    // --- Update nonce & state ---
    const updated = await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        lastNonce: data.nonce,
        nextNonce: ticket.nextNonce ? ticket.nextNonce + 1 : data.nonce + 1,
        currentState: verdict === ScanVerdict.OK ? PresenceState.INSIDE : PresenceState.OUTSIDE,
      },
    });

    return {
      ticket: mapTicket(updated),
      log: mapScanLog(logRow),
    };

    // const result = await this.verifyTokenService.verify({
    //   token: data.token,
    //   deviceHash: data.deviceHash,
    //   gate: data.gate,
    // });

    // // if fail → write log + return
    // if (!result.valid) {
    //   return this.writeFailureLog(result, data.byUserId);
    // }

    // // if OK → toggle state + update nonce
    // return this.writeSuccessLog(result, data.byUserId);
  }

  // -------------------------------------------------------------
  // 7) Reset ShareGuard (admin)
  // -------------------------------------------------------------
  async resetShareGuard(ticketId: string): Promise<ShareGuard | null> {
    const guard = await this.prisma.shareGuard.findUnique({ where: { ticketId } });
    if (!guard) {
      return null;
    }

    const updated = await this.prisma.shareGuard.update({
      where: { ticketId },
      data: {
        failCount: 0,
        blockedUntil: null,
        reason: null,
      },
    });

    return updated;
  }

  // -------------------------------------------------------------
  // Assign seat to ticket (once)
  // -------------------------------------------------------------
  async assignSeat(ticketId: string, seatId: string): Promise<Ticket> {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (ticket.seatId) {
      throw new BadRequestException('Seat already assigned');
    }

    const row = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { seatId },
    });

    return mapTicket(row);
  }

  // -------------------------------------------------------------
  // Fix: Add SeatId based on guestProfileId (Kafka event)
  // -------------------------------------------------------------
  async addSeatId(input: {
    id: string | undefined;
    eventId: string;
    guestId: string;
  }): Promise<void> {
    const { id: seatId, eventId, guestId } = input;

    if (!seatId) {
      return;
    }

    const ticket = await this.prisma.ticket.findFirst({
      where: { eventId, guestProfileId: guestId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: { seatId },
    });
  }

  // -------------------------------------------------------------
  // update ticket (simple fields)
  // -------------------------------------------------------------
  async update(input: UpdateTicketInput): Promise<void> {
    await this.ensureExists(input.id);

    await this.prisma.ticket.update({
      where: { id: input.id },
      data: {
        revoked: input.revoked,
        currentState: input.currentState,
        seatId: input.seatId ?? null,
      },
    });
  }

  // -------------------------------------------------------------
  // delete ticket (remove ScanLogs + ShareGuard)
  // -------------------------------------------------------------
  async delete(ticketId: string): Promise<void> {
    await this.ensureExists(ticketId);

    await this.prisma.$transaction(async (tx) => {
      await tx.scanLog.deleteMany({ where: { ticketId } });
      await tx.shareGuard.deleteMany({ where: { ticketId } });
      await tx.ticket.delete({ where: { id: ticketId } });
    });
  }

  async deleteMany(guestId: string): Promise<void> {
    // Alle Tickets des Gasts laden
    const tickets = await this.prisma.ticket.findMany({
      where: { guestProfileId: guestId },
    });

    if (tickets.length === 0) {
      return; // nichts zu löschen
    }

    await this.prisma.$transaction(async (tx) => {
      for (const ticket of tickets) {
        const ticketId = ticket.id;

        // Logs & ShareGuard löschen
        await tx.scanLog.deleteMany({
          where: { ticketId },
        });

        await tx.shareGuard.deleteMany({
          where: { ticketId },
        });

        // Ticket löschen
        await tx.ticket.delete({
          where: { id: ticketId },
        });
      }
    });
  }

  // -------------------------------------------------------------
  // Helper
  // -------------------------------------------------------------
  private async ensureExists(id: string): Promise<Ticket> {
    const found = await this.prisma.ticket.findUnique({ where: { id } });
    if (!found) {
      throw new NotFoundException('Ticket not found');
    }
    return mapTicket(found);
  }

  async generateQrToken(input: GenerateTokenInput): Promise<string> {
    const { ticketId, deviceHash } = input;
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const payload: TicketTokenPayload = {
      tid: ticket.id,
      eid: ticket.eventId,
      gid: ticket.guestProfileId ?? null,
      sid: ticket.seatId ?? null,
      dn: ticket.nextNonce ?? 1,
      ts: Date.now(),
      dh: deviceHash,
    };

    return generateWithoutDots(payload);
  }

  /**
   * Verify QR token (JWE), device hash, nonce and ticket state.
   * This performs a full security validation without modifying state.
   *
   * Used by both:
   *  - securityScan() in TicketWriteService (pre-check)
   *  - "preview scans" or validators
   */
  async verify(input: VerifyTokenInput): Promise<VerifyPayload> {
    const { token } = input;

    // ---------------------------------------------------------
    // 1) Decode JWE and validate structure
    // ---------------------------------------------------------
    let payload: TicketTokenPayload;
    try {
      payload = decodeWithoutDots(token);
    } catch (e) {
      throw new BadRequestException('Invalid QR token (cannot decrypt)');
    }

    const { tid, eid, gid: _gid, sid: _sid, dn, ts, dh } = payload;

    if (!tid || !eid || !dn || !ts) {
      throw new BadRequestException('Malformed QR payload');
    }

    // ---------------------------------------------------------
    // 2) Fetch ticket
    // ---------------------------------------------------------
    const ticket = await this.prisma.ticket.findUnique({ where: { id: tid } });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // ---------------------------------------------------------
    // 3) Core security validations
    // ---------------------------------------------------------
    let verdict: ScanVerdict = ScanVerdict.OK;

    // Ticket revoked?
    if (ticket.revoked) {
      verdict = ScanVerdict.REVOKED;
    }

    // Device binding mismatch
    if (ticket.deviceHash && dh && ticket.deviceHash !== dh) {
      verdict = ScanVerdict.DEVICE_MISMATCH;
    }

    // Replay protection
    if (ticket.lastNonce !== null && dn <= (ticket.lastNonce ?? 0)) {
      verdict = ScanVerdict.REPLAY;
    }

    // Nonce invalid (future mismatch)
    if (ticket.nextNonce !== null && dn !== ticket.nextNonce) {
      verdict = ScanVerdict.INVALID_NONCE;
    }

    // Token age validation (optional)
    const TOKEN_LIFETIME_MS = Number(process.env.QR_TOKEN_MAX_AGE_MS ?? 60_000);
    if (Date.now() - ts > TOKEN_LIFETIME_MS) {
      verdict = ScanVerdict.REPLAY;
    }

    if (verdict === ScanVerdict.OK && !ticket.checkedInAt) {
      ticket.checkedInAt = new Date();
    }
    // ---------------------------------------------------------
    // 4) Result structure (no state update here)
    // ---------------------------------------------------------
    return {
      ticket: mapTicket(ticket),
      payload,
      verdict,
      valid: verdict === ScanVerdict.OK,
      expectedNonce: ticket.nextNonce,
      receivedNonce: dn,
      deviceMatched: !ticket.deviceHash || !dh || ticket.deviceHash === dh,
    };
  }
}
