// src/ticket/resolver/ticket-query.resolver.ts

import { ScanLog } from '../models/entities/scan-log.entity.js';
import { Ticket } from '../models/entities/ticket.entity.js';
import { TicketReadService } from '../service/ticket-read.service.js';
import { UseGuards } from '@nestjs/common';
import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import {
  CookieAuthGuard,
  CurrentUser,
  CurrentUserData,
} from '@omnixys/security';

@Resolver(() => Ticket)
export class TicketQueryResolver {
  constructor(private readonly ticketRead: TicketReadService) {}

  // ---------------------------------------------------------
  // 1) Get ticket by ID
  // ---------------------------------------------------------
  @UseGuards(CookieAuthGuard)
  @Query(() => Ticket, {
    description: 'Fetch a single ticket by its cuid',
  })
  async ticketById(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Ticket> {
    return this.ticketRead.findById(id);
  }

  @UseGuards(CookieAuthGuard)
  @Query(() => [Ticket], {
    description: 'Fetch a single ticket by its cuid',
  })
  async getAllTickets(): Promise<Ticket[]> {
    return this.ticketRead.findMany();
  }

  @Query(() => Ticket, {
    description: 'Fetch a single ticket by its cuid',
  })
  async ticketById2(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Ticket> {
    return this.ticketRead.findById(id);
  }

  // ---------------------------------------------------------
  // 2) Get all tickets for a given event
  // ---------------------------------------------------------
  @UseGuards(CookieAuthGuard)
  @Query(() => [Ticket], {
    description: 'Fetch all tickets belonging to a specific event',
  })
  async ticketsByEvent(
    @Args('eventId', { type: () => ID }) eventId: string,
  ): Promise<Ticket[]> {
    return this.ticketRead.findByEvent(eventId);
  }

  // ---------------------------------------------------------
  // 3) Find ticket belonging to a specific guest profile
  // ---------------------------------------------------------
  @UseGuards(CookieAuthGuard)
  @Query(() => [Ticket], {
    description: 'Find tickets linked to a specific guestProfileId',
  })
  async ticketsByGuest(
    @Args('guestProfileId', { type: () => ID }) guestProfileId: string,
  ): Promise<Ticket[]> {
    return this.ticketRead.findByGuest(guestProfileId);
  }

  // ---------------------------------------------------------
  // 4) Find ticket by invitationId (1:1 relationship)
  // ---------------------------------------------------------
  @UseGuards(CookieAuthGuard)
  @Query(() => Ticket, {
    description: 'Find the ticket created for a specific invitationId',
  })
  async ticketByInvitation(
    @Args('invitationId', { type: () => ID }) invitationId: string,
  ): Promise<Ticket> {
    return this.ticketRead.findByInvitation(invitationId);
  }

  // ---------------------------------------------------------
  // 5) Load all scan logs for a given ticket
  // ---------------------------------------------------------
  @UseGuards(CookieAuthGuard)
  @Query(() => [ScanLog], {
    description: 'Load all security scan logs of a ticket',
  })
  async scanLogsByTicket(
    @Args('ticketId', { type: () => ID }) ticketId: string,
  ): Promise<ScanLog[]> {
    return this.ticketRead.scanLogs(ticketId);
  }

  @UseGuards(CookieAuthGuard)
  @Query(() => [Ticket], {
    description: 'Find tickets linked to a authenticated user',
  })
  async getMyTickets(@CurrentUser() user: CurrentUserData): Promise<Ticket[]> {
    return this.ticketRead.findByGuest(user.id);
  }
}
