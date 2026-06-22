// src/ticket/service/ticket-read.service.ts

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

@Injectable()
export class TicketReadService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find a ticket by ID.
   */
  async findById(id: string): Promise<TicketPayload> {
    const row = await this.prisma.ticket.findUnique({
      where: { id },
    });

    if (!row) {
      throw new TicketNotFoundException(id);
    }

    return mapTicket(row);
  }

  async findByIdForActor(id: string, actorId: string, allowAny = false): Promise<TicketPayload> {
    const ticket = await this.findById(id);
    if (!allowAny && ticket.guestProfileId !== actorId) {
      throw new TicketAccessDeniedException(id, 'ticket-owner-mismatch');
    }
    return ticket;
  }

  /**
   * Find all tickets matching arbitrary filters.
   */
  async findMany(): Promise<TicketPayload[]> {
    const rows = await this.prisma.ticket.findMany();
    return mapTickets(rows);
  }

  /**
   * Find ticket by invitationId (unique).
   */
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
    allowAny = false,
  ): Promise<TicketPayload> {
    const ticket = await this.findByInvitation(invitationId);
    if (!allowAny && ticket.guestProfileId !== actorId) {
      throw new TicketAccessDeniedException(ticket.id, 'ticket-owner-mismatch');
    }
    return ticket;
  }

  /**
   * Find all tickets belonging to an event.
   */
  async findByEvent(eventId: string): Promise<TicketPayload[]> {
    const rows = await this.prisma.ticket.findMany({
      where: { eventId },
      orderBy: { createdAt: 'asc' },
    });

    return mapTickets(rows);
  }

  /**
   * Find ticket by guestProfileId (unique).
   */
  async findByGuest(guestProfileId: string): Promise<TicketPayload[]> {
    const row = await this.prisma.ticket.findMany({
      where: { guestProfileId },
    });

    return mapTickets(row);
  }

  findByGuestForActor(
    guestProfileId: string,
    actorId: string,
    allowAny = false,
  ): Promise<TicketPayload[]> {
    if (!allowAny && guestProfileId !== actorId) {
      throw new TicketAccessDeniedException(undefined, 'guest-owner-mismatch');
    }
    return this.findByGuest(guestProfileId);
  }

  /**
   * Read scan logs of a ticket.
   */
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
    allowAny = false,
  ): Promise<ScanLogPayload[]> {
    await this.findByIdForActor(ticketId, actorId, allowAny);
    return this.scanLogs(ticketId);
  }

  /**
   * Find a ticket by device hash. (Fingerprint binding)
   */
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
