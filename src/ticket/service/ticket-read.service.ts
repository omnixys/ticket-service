import { PrismaService } from '../../prisma/prisma.service.js';
import {
  TicketAccessDeniedException,
  TicketNotFoundException,
} from '../errors/ticket-domain.error.js';
import { mapScanLogs } from '../models/mapper/scan-logs.mapper.js';
import { mapTicket, mapTickets } from '../models/mapper/ticket.mapper.js';
import { ScanLogPayload } from '../models/payloads/scan-log-list.payload.js';
import { TicketPayload } from '../models/payloads/ticket-payload.js';
import { Injectable } from '@nestjs/common';
import { EventRoleType } from '@omnixys/contracts';
function isAdmin(eventRole: EventRoleType | null): boolean {
  return eventRole === EventRoleType.ADMIN;
}

@Injectable()
export class TicketReadService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<TicketPayload> {
    const row = await this.prisma.ticket.findUnique({
      where: { id },
    });

    if (!row) {
      throw new TicketNotFoundException(id);
    }

    return mapTicket(row);
  }

  async findMany(): Promise<TicketPayload[]> {
    const rows = await this.prisma.ticket.findMany();
    return mapTickets(rows);
  }

  async findByIdForActor(
    id: string,
    actorId: string,
    eventRole: EventRoleType | null = null,
  ): Promise<TicketPayload> {
    const ticket = await this.findById(id);
    if (ticket.guestProfileId !== actorId && !isAdmin(eventRole)) {
      throw new TicketAccessDeniedException(id, 'ticket-owner-mismatch');
    }
    return ticket;
  }

  async findByInvitation(invitationId: string): Promise<TicketPayload> {
    const row = await this.prisma.ticket.findUnique({
      where: { invitationId },
    });

    if (!row) {
      throw new TicketNotFoundException(invitationId);
    }

    return mapTicket(row);
  }

  async findByInvitationForActor(
    invitationId: string,
    actorId: string,
    eventRole: EventRoleType | null = null,
  ): Promise<TicketPayload> {
    const ticket = await this.findByInvitation(invitationId);
    if (ticket.guestProfileId !== actorId && !isAdmin(eventRole)) {
      throw new TicketAccessDeniedException(ticket.id, 'ticket-owner-mismatch');
    }
    return ticket;
  }

  async findByEvent(eventId: string): Promise<TicketPayload[]> {
    const rows = await this.prisma.ticket.findMany({
      where: { eventId },
      orderBy: { createdAt: 'asc' },
    });

    return mapTickets(rows);
  }

  async findByGuest(guestProfileId: string): Promise<TicketPayload[]> {
    const row = await this.prisma.ticket.findMany({
      where: { guestProfileId },
    });

    return mapTickets(row);
  }

  findByGuestForActor(
    guestProfileId: string,
    actorId: string,
    eventRole: EventRoleType | null = null,
  ): Promise<TicketPayload[]> {
    if (guestProfileId !== actorId && !isAdmin(eventRole)) {
      throw new TicketAccessDeniedException(undefined, 'guest-owner-mismatch');
    }
    return this.findByGuest(guestProfileId);
  }

  async scanLogs(ticketId: string): Promise<ScanLogPayload[]> {
    const logs = await this.prisma.scanLog.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'desc' },
    });

    return mapScanLogs(logs);
  }

  async scanLogsForActor(
    ticketId: string,
    actorId: string,
    eventRole: EventRoleType | null = null,
  ): Promise<ScanLogPayload[]> {
    await this.findByIdForActor(ticketId, actorId, eventRole);
    return this.scanLogs(ticketId);
  }

  async findByDeviceHash(deviceId: string): Promise<TicketPayload> {
    const row = await this.prisma.ticket.findFirst({
      where: { deviceId },
    });

    if (!row) {
      throw new TicketNotFoundException();
    }

    return mapTicket(row);
  }
}
