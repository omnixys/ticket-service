import { PresenceState } from '../../prisma/generated/client.js';
import type { ScanLogUncheckedCreateInput } from '../../prisma/generated/models/ScanLog.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ScanVerdict } from '../models/enums/scan-verdict.enum.js';
import { ActivateDeviceDTO } from '../models/inputs/activate-device.input.js';
import { mapTicket } from '../models/mapper/ticket.mapper.js';
import { TicketPayload } from '../models/payloads/ticket-payload.js';
import { TokenService } from './token.service.js';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OmnixysLogger } from '@omnixys/logger';
import { TraceRunner } from '@omnixys/observability';

export interface UpdateTicketInput {
  id: string;
  revoked?: boolean;
  currentState?: PresenceState;
  seatId: string;
}

@Injectable()
export class TicketWriteService {
  private readonly logger;

  constructor(
    private readonly prisma: PrismaService,
    private readonly loggerService: OmnixysLogger,
    private readonly token: TokenService,
  ) {
    this.logger = this.loggerService.log(this.constructor.name);
  }

  async createTicket(data: {
    eventId: string;
    invitationId: string;
    userId: string;
    seatId: string;
    actorId: string;
  }): Promise<TicketPayload> {
    return TraceRunner.run('[SERVICE] createTicket', async () => {
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
          guestProfileId: data.userId ?? null,
          seatId: data.seatId ?? null,
          nextNonce: 1,
        },
      });

      return mapTicket(created);
    });
  }

  async update(input: UpdateTicketInput): Promise<void> {
    await this.ensureExists(input.id);

    await this.prisma.ticket.update({
      where: { id: input.id },
      data: {
        revoked: input.revoked,
        currentState: input.currentState,
        seatId: input.seatId,
      },
    });
  }

  async activateDevice(input: ActivateDeviceDTO): Promise<TicketPayload> {
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({
        where: { id: input.ticketId },
      });

      if (!ticket) {
        throw new NotFoundException('Ticket not found');
      }

      if (ticket.devicePublicKey && ticket.devicePublicKey !== input.publicKey) {
        throw new BadRequestException('Device already bound');
      }

      const updated = await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          devicePublicKey: input.publicKey,
          deviceId: input.deviceId,
          deviceActivationAt: new Date(),
          deviceActivationIP: input.ip,
        },
      });

      return mapTicket(updated);
    });
  }

  async generateToken(ticketId: string): Promise<string> {
    const ticket = await this.prisma.ticket.findUniqueOrThrow({
      where: { id: ticketId },
    });

    if (ticket.nextNonce === null) {
      throw new BadRequestException('Ticket nonce is not initialized');
    }

    return this.token.generate({
      tid: ticket.id,
      eid: ticket.eventId,
      gid: ticket.guestProfileId,
      sid: ticket.seatId,
      dn: ticket.nextNonce,
      ts: Date.now(),
      dh: ticket.deviceId ? this.token.hashDevice(ticket.deviceId) : undefined,
    });
  }

  async delete(ticketId: string): Promise<void> {
    await this.ensureExists(ticketId);

    await this.prisma.$transaction(async (tx) => {
      await tx.scanLog.deleteMany({ where: { ticketId } });
      await tx.shareGuard.deleteMany({ where: { ticketId } });
      await tx.ticket.delete({ where: { id: ticketId } });
    });
  }

  async deleteByEventIds(eventIds: string[]): Promise<void> {
    return TraceRunner.run('[SERVICE] deleteByEventIds', async () => {
      this.logger.warn('Delete tickets for events=%o', eventIds);

      if (!eventIds?.length) {
        this.logger.warn('deleteByEventIds skipped → empty input');
        return;
      }

      const count = await this.prisma.$transaction(async (tx) => {
        /**
         * 1. Get affected ticketIds
         */
        const tickets = await tx.ticket.findMany({
          where: {
            eventId: { in: eventIds },
          },
          select: { id: true },
        });

        const ticketIds = tickets.map((t) => t.id);

        if (ticketIds.length === 0) {
          this.logger.warn('No tickets found for events=%o', eventIds);
          return;
        }

        /**
         * 2. Delete dependent data first
         */
        await tx.scanLog.deleteMany({
          where: {
            ticketId: { in: ticketIds },
          },
        });

        await tx.shareGuard.deleteMany({
          where: {
            ticketId: { in: ticketIds },
          },
        });

        /**
         * 3. Delete tickets
         */
        const count = await tx.ticket.deleteMany({
          where: {
            id: { in: ticketIds },
          },
        });
        return count;
      });

      this.logger.info('Tickets deleted for events=%o count=%s', eventIds, count);
    });
  }

  async deleteByGuestId(guestId: string): Promise<void> {
    return TraceRunner.run('[SERVICE] deleteByGuestId', async () => {
      this.logger.warn('Delete tickets for guestId=%s', guestId);

      if (!guestId) {
        this.logger.warn('deleteByGuestId skipped → no guestId');
        return;
      }

      await this.prisma.$transaction(async (tx) => {
        const tickets = await tx.ticket.findMany({
          where: {
            guestProfileId: guestId,
          },
          select: { id: true },
        });

        const ticketIds = tickets.map((t) => t.id);

        if (ticketIds.length === 0) {
          this.logger.warn('No tickets found for guestId=%s', guestId);
          return;
        }

        await tx.scanLog.deleteMany({
          where: {
            ticketId: { in: ticketIds },
          },
        });

        await tx.shareGuard.deleteMany({
          where: {
            ticketId: { in: ticketIds },
          },
        });

        await tx.ticket.deleteMany({
          where: {
            id: { in: ticketIds },
          },
        });
      });

      this.logger.info('Tickets deleted for guestId=%s', guestId);
    });
  }

  private async ensureExists(id: string): Promise<TicketPayload> {
    const found = await this.prisma.ticket.findUnique({ where: { id } });

    if (!found) {
      throw new NotFoundException('Ticket not found');
    }

    return mapTicket(found);
  }

  async revoke({
    ticketId,
    reason,
    actorId,
  }: {
    ticketId: string;
    reason?: string;
    actorId: string;
  }): Promise<TicketPayload> {
    const now = new Date();
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        revoked: true,
        currentState: 'OUTSIDE',
        revokedAt: now,
        revokedBy: actorId,
        revokedReason: reason ?? 'Manual revoke',
      },
    });

    // optional: write ScanLog "REVOKED"
    const scanLogData: ScanLogUncheckedCreateInput = {
      ticketId,
      eventId: ticket.eventId,
      direction: PresenceState.OUTSIDE,
      verdict: ScanVerdict.REVOKED,
      actorId,
    };

    await this.prisma.scanLog.create({ data: scanLogData });

    return mapTicket(updated);
  }
}
