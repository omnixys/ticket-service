import { ScanLogPayload } from '../models/payloads/scan-log-list.payload.js';
import { TicketPayload } from '../models/payloads/ticket-payload.js';
import { TicketReadService } from '../service/ticket-read.service.js';
import { UseGuards } from '@nestjs/common';
import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import {
  CookieAuthGuard,
  CurrentUser,
  CurrentUserData,
} from '@omnixys/security';

@Resolver(() => TicketPayload)
export class TicketQueryResolver {
  constructor(private readonly ticketRead: TicketReadService) {}

  @Query(() => TicketPayload, {
    description: 'Fetch a single ticket by its cuid',
  })
  async ticketById(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<TicketPayload> {
    return this.ticketRead.findById(id);
  }

  @UseGuards(CookieAuthGuard)
  @Query(() => [TicketPayload], {
    description: 'Fetch a single ticket by its cuid',
  })
  async getAllTickets(): Promise<TicketPayload[]> {
    return this.ticketRead.findMany();
  }

  // ---------------------------------------------------------
  // 2) Get all tickets for a given event
  // ---------------------------------------------------------
  @UseGuards(CookieAuthGuard)
  @Query(() => [TicketPayload], {
    description: 'Fetch all tickets belonging to a specific event',
  })
  async ticketsByEvent(
    @Args('eventId', { type: () => ID }) eventId: string,
  ): Promise<TicketPayload[]> {
    return this.ticketRead.findByEvent(eventId);
  }

  // ---------------------------------------------------------
  // 3) Find ticket belonging to a specific guest profile
  // ---------------------------------------------------------
  @UseGuards(CookieAuthGuard)
  @Query(() => [TicketPayload], {
    description: 'Find tickets linked to a specific guestProfileId',
  })
  async ticketsByGuest(
    @Args('guestProfileId', { type: () => ID }) guestProfileId: string,
  ): Promise<TicketPayload[]> {
    return this.ticketRead.findByGuest(guestProfileId);
  }

  // ---------------------------------------------------------
  // 4) Find ticket by invitationId (1:1 relationship)
  // ---------------------------------------------------------
  @UseGuards(CookieAuthGuard)
  @Query(() => TicketPayload, {
    description: 'Find the ticket created for a specific invitationId',
  })
  async ticketByInvitation(
    @Args('invitationId', { type: () => ID }) invitationId: string,
  ): Promise<TicketPayload> {
    return this.ticketRead.findByInvitation(invitationId);
  }

  // ---------------------------------------------------------
  // 5) Load all scan logs for a given ticket
  // ---------------------------------------------------------
  @UseGuards(CookieAuthGuard)
  @Query(() => [ScanLogPayload], {
    description: 'Load all security scan logs of a ticket',
  })
  async scanLogsByTicket(
    @Args('ticketId', { type: () => ID }) ticketId: string,
  ): Promise<ScanLogPayload[]> {
    return this.ticketRead.scanLogs(ticketId);
  }

  @UseGuards(CookieAuthGuard)
  @Query(() => [TicketPayload], {
    description: 'Find tickets linked to a authenticated user',
  })
  async getMyTickets(
    @CurrentUser() user: CurrentUserData,
  ): Promise<TicketPayload[]> {
    return this.ticketRead.findByGuest(user.id);
  }
}
