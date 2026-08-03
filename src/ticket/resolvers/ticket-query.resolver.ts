import { ScanLogPayload } from '../models/payloads/scan-log-list.payload.js';
import { TicketPayload } from '../models/payloads/ticket-payload.js';
import { TicketReadService } from '../service/ticket-read.service.js';
import { UseGuards } from '@nestjs/common';
import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import { EventPermissionKey, RealmRoleType } from '@omnixys/contracts-ts';
import { EventRoleResolver } from '@omnixys/security-ts';
import {
  CookieAuthGuard,
  CurrentUser,
  CurrentUserData,
  EventPermissionGuard,
  EventPermissions,
  RoleGuard,
  Roles,
} from '@omnixys/security-ts';

@Resolver(() => TicketPayload)
@UseGuards(CookieAuthGuard)
export class TicketQueryResolver {
  constructor(
    private readonly ticketRead: TicketReadService,
    private readonly eventRoleResolver: EventRoleResolver,
  ) {}

  @Query(() => TicketPayload, {
    description: 'Fetch a single ticket by its cuid',
  })
  async ticketById(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<TicketPayload> {
    const ticket = await this.ticketRead.findById(id);
    const eventRole = await this.eventRoleResolver.getRoleForUser(
      user.id,
      ticket.eventId,
    );
    return this.ticketRead.findByIdForActor(id, user.id, eventRole);
  }

  @UseGuards(RoleGuard, EventPermissionGuard)
  @Roles(RealmRoleType.USER)
  @EventPermissions(EventPermissionKey.ViewTickets)
  @Query(() => [TicketPayload], {
    description: 'Fetch all tickets',
  })
  async getAllTickets(): Promise<TicketPayload[]> {
    return this.ticketRead.findMany();
  }

  @UseGuards(RoleGuard, EventPermissionGuard)
  @Roles(RealmRoleType.USER)
  @EventPermissions(EventPermissionKey.ViewTickets)
  @Query(() => [TicketPayload], {
    description: 'Fetch all tickets belonging to a specific event',
  })
  async ticketsByEvent(
    @Args('eventId', { type: () => ID }) eventId: string,
  ): Promise<TicketPayload[]> {
    return this.ticketRead.findByEvent(eventId);
  }

  @Query(() => [TicketPayload], {
    description: 'Find tickets linked to a specific guestProfileId',
  })
  async ticketsByGuest(
    @Args('guestProfileId', { type: () => ID }) guestProfileId: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<TicketPayload[]> {
    if (guestProfileId !== user.id) {
      return [];
    }
    return this.ticketRead.findByGuest(guestProfileId);
  }

  @Query(() => TicketPayload, {
    description: 'Find the ticket created for a specific invitationId',
  })
  async ticketByInvitation(
    @Args('invitationId', { type: () => ID }) invitationId: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<TicketPayload> {
    const ticket = await this.ticketRead.findByInvitation(invitationId);
    const eventRole = await this.eventRoleResolver.getRoleForUser(
      user.id,
      ticket.eventId,
    );
    return this.ticketRead.findByInvitationForActor(
      invitationId,
      user.id,
      eventRole,
    );
  }

  @Query(() => [ScanLogPayload], {
    description: 'Load all security scan logs of a ticket',
  })
  async scanLogsByTicket(
    @Args('ticketId', { type: () => ID }) ticketId: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<ScanLogPayload[]> {
    const ticket = await this.ticketRead.findById(ticketId);
    const eventRole = await this.eventRoleResolver.getRoleForUser(
      user.id,
      ticket.eventId,
    );
    return this.ticketRead.scanLogsForActor(ticketId, user.id, eventRole);
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
