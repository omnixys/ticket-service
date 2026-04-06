// src/ticket/service/ticket-read.service.ts

import { PrismaService } from '../../prisma/prisma.service.js';
import { mapScanLogs } from '../models/mapper/scan-logs.mapper.js';
import { mapTicket, mapTickets } from '../models/mapper/ticket.mapper.js';
import { ScanLogPayload } from '../models/payloads/scan-log-list.payload.js';
import { TicketPayload } from '../models/payloads/ticket-payload.js';
import { Injectable, NotFoundException } from '@nestjs/common';

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
      throw new NotFoundException('Ticket not found');
    }

    return mapTicket(row);
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
      throw new NotFoundException('Ticket not found for invitation');
    }

    return mapTicket(row);
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

  /**
   * Find a ticket by device hash. (Fingerprint binding)
   */
  async findByDeviceHash(deviceId: string): Promise<TicketPayload> {
    const row = await this.prisma.ticket.findFirst({
      where: { deviceId },
    });

    if (!row) {
      throw new NotFoundException('Ticket not bound to this device');
    }

    return mapTicket(row);
  }

  
}
