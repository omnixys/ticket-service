import { ScanLogPayload } from '../models/payloads/scan-log-list.payload.js';
import { TicketPayload } from '../models/payloads/ticket-payload.js';
import { TicketReadService } from '../service/ticket-read.service.js';
import { UseGuards } from '@nestjs/common';
import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import { RealmRoleType } from '@omnixys/contracts';
import {
  CookieAuthGuard,
  CurrentUser,
  CurrentUserData,
  RoleGuard,
  Roles,
} from '@omnixys/security';

@Resolver(() => TicketPayload)
@UseGuards(CookieAuthGuard)
export class TicketQueryResolver {
  constructor(private readonly ticketRead: TicketReadService) {}

  @Query(() => TicketPayload, {
    description: 'Fetch a single ticket by its cuid',
  })
  async ticketById(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<TicketPayload> {
    return this.ticketRead.findByIdForActor(
      id,
      user.id,
      user.role === RealmRoleType.ADMIN,
    );
  }

  @UseGuards(RoleGuard)
  @Roles(RealmRoleType.ADMIN)
  @Query(() => [TicketPayload], {
    description: 'Fetch a single ticket by its cuid',
  })
  async getAllTickets(): Promise<TicketPayload[]> {
    return this.ticketRead.findMany();
  }

  // ---------------------------------------------------------
  // 2) Get all tickets for a given event
  // ---------------------------------------------------------
  @UseGuards(RoleGuard)
  @Roles(RealmRoleType.ADMIN)
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
  @Query(() => [TicketPayload], {
    description: 'Find tickets linked to a specific guestProfileId',
  })
  async ticketsByGuest(
    @Args('guestProfileId', { type: () => ID }) guestProfileId: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<TicketPayload[]> {
    return this.ticketRead.findByGuestForActor(
      guestProfileId,
      user.id,
      user.role === RealmRoleType.ADMIN,
    );
  }

  // ---------------------------------------------------------
  // 4) Find ticket by invitationId (1:1 relationship)
  // ---------------------------------------------------------
  @Query(() => TicketPayload, {
    description: 'Find the ticket created for a specific invitationId',
  })
  async ticketByInvitation(
    @Args('invitationId', { type: () => ID }) invitationId: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<TicketPayload> {
    return this.ticketRead.findByInvitationForActor(
      invitationId,
      user.id,
      user.role === RealmRoleType.ADMIN,
    );
  }

  // ---------------------------------------------------------
  // 5) Load all scan logs for a given ticket
  // ---------------------------------------------------------
  @Query(() => [ScanLogPayload], {
    description: 'Load all security scan logs of a ticket',
  })
  async scanLogsByTicket(
    @Args('ticketId', { type: () => ID }) ticketId: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<ScanLogPayload[]> {
    return this.ticketRead.scanLogsForActor(
      ticketId,
      user.id,
      user.role === RealmRoleType.ADMIN,
    );
  }

  @Query(() => [TicketPayload], {
    description: 'Find tickets linked to a authenticated user',
  })
  async getMyTickets(
    @CurrentUser() user: CurrentUserData,
  ): Promise<TicketPayload[]> {
    return this.ticketRead.findByGuest(user.id);
  }
}
