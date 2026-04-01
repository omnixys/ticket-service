import { UseGuards } from '@nestjs/common';
import {
  Args,
  Field,
  ID,
  InputType,
  Mutation,
  ObjectType,
  Resolver,
} from '@nestjs/graphql';

import { TicketWriteService } from '../service/ticket-write.service.js';

import { ScanLog } from '../models/entities/scan-log.entity.js';
import { Ticket } from '../models/entities/ticket.entity.js';

// Input
import { AssignSeatInputTicket } from '../models/inputs/assign-seat.input.js';
import { CreateTicketInput } from '../models/inputs/create-ticket.input.js';
import { RotateNonceInput } from '../models/inputs/rotate-nonce.input.js';
import { SecurityScanInput } from '../models/inputs/security-scan.input.js';
import { TogglePresenceInput } from '../models/inputs/toggle-presence.input.js';
import { VerifyTokenInput } from '../models/inputs/verify-token.input.js';
import { VerifyPayload } from '../models/payloads/verify.payload.js';
import {
  CookieAuthGuard,
  CurrentUser,
  CurrentUserData,
} from '@omnixys/security';

@ObjectType()
export class TogglePresence {
  @Field(() => Ticket)
  ticket!: Ticket;
  @Field(() => ScanLog)
  log!: ScanLog;
}

@InputType()
export class GenerateTokenInput {
  @Field(() => String)
  ticketId!: string;
  @Field(() => String)
  deviceHash!: string;
}

@Resolver(() => Ticket)
export class TicketMutationResolver {
  constructor(private readonly ticketWrite: TicketWriteService) {}

  // ---------------------------------------------------------
  // 1) Create a ticket after approval
  // ---------------------------------------------------------
  @UseGuards(CookieAuthGuard)
  @Mutation(() => Ticket, {
    description: 'Create a new ticket for an approved invitation',
  })
  async createTicket(
    @Args('input') input: CreateTicketInput,
    @CurrentUser() user: CurrentUserData,
  ): Promise<Ticket> {
    return this.ticketWrite.createTicket({ ...input, actorId: user.id });
  }

  // ---------------------------------------------------------
  // 2) Bind device (first-time activation)
  // ---------------------------------------------------------
  // @Mutation(() => Ticket, {
  //   description: 'Bind a device to a ticket (first activation)',
  // })
  // async activateDevice(
  //   @Args('input') input: ActivateDeviceInput,
  //   @Context() ctx: GqlContext,
  // ): Promise<Ticket> {
  //   return this.ticketWrite.activateDevice(input.ticketId, {
  //     deviceHash: input.deviceHash,
  //     devicePublicKey: input.devicePublicKey,
  //     ip: ctx.req.ip ?? input.ip ?? null,
  //   });
  // }

  // ---------------------------------------------------------
  // 3) Rotate nonce for QR token (security)
  // ---------------------------------------------------------
  @Mutation(() => Ticket, {
    description: 'Rotate nonce for a ticket’s QR token',
  })
  async rotateNonce(@Args('input') input: RotateNonceInput): Promise<Ticket> {
    return this.ticketWrite.rotateNonce(input.ticketId);
  }

  @Mutation(() => String, {
    description: 'Rotate nonce for a ticket’s QR token',
  })
  async generateToken(
    @Args('input', { type: () => GenerateTokenInput })
    input: GenerateTokenInput,
  ): Promise<string> {
    return this.ticketWrite.generateQrToken(input);
  }

  @Mutation(() => VerifyPayload, {
    description: 'Rotate nonce for a ticket’s QR token',
  })
  async verifyToken(
    @Args('input') input: VerifyTokenInput,
  ): Promise<VerifyPayload> {
    return this.ticketWrite.verify(input);
  }

  // ---------------------------------------------------------
  // 4) Revoke a ticket manually
  // ---------------------------------------------------------
  @UseGuards(CookieAuthGuard)
  @Mutation(() => Ticket, {
    description: 'Revoke a ticket (security or admin)',
  })
  async revokeTicket(
    @Args('ticketId', { type: () => ID }) ticketId: string,
    @Args('reason', { nullable: true }) reason?: string,
  ): Promise<Ticket> {
    return this.ticketWrite.revoke(ticketId, reason);
  }

  // ---------------------------------------------------------
  // 5) Toggle INSIDE/OUTSIDE state at gate
  // ---------------------------------------------------------
  @UseGuards(CookieAuthGuard)
  @Mutation(() => TogglePresence, {
    description: 'Toggle INSIDE/OUTSIDE state of a ticket',
  })
  async togglePresence(
    @Args('input', { type: () => TogglePresenceInput })
    input: TogglePresenceInput,
  ): Promise<TogglePresence> {
    const { ticketId, userId, gate } = input;
    return this.ticketWrite.togglePresence(ticketId, userId, gate);
  }

  // ---------------------------------------------------------
  // 6) Full security scan (nonce/device checks)
  // ---------------------------------------------------------
  @UseGuards(CookieAuthGuard)
  @Mutation(() => ScanLog, {
    description: 'Perform a full scan with nonce and device checks',
  })
  async securityScan(
    @Args('input') input: SecurityScanInput,
  ): Promise<{ ticket: Ticket; log: ScanLog }> {
    return this.ticketWrite.securityScan(input);
  }

  // ---------------------------------------------------------
  // 7) Assign seat to ticket (once)
  // ---------------------------------------------------------
  @UseGuards(CookieAuthGuard)
  @Mutation(() => Ticket, {
    description: 'Assign a seat to a ticket (can only be done once)',
    name: 'assignSeatToTicket',
  })
  async assignSeat(
    @Args('input') input: AssignSeatInputTicket,
  ): Promise<Ticket> {
    return this.ticketWrite.assignSeat(input.ticketId, input.seatId);
  }

  // ---------------------------------------------------------
  // 8) Permanently delete a ticket (admin)
  // ---------------------------------------------------------
  @UseGuards(CookieAuthGuard)
  @Mutation(() => Boolean, {
    description: 'Delete ticket and all its logs (admin only)',
  })
  async deleteTicket(
    @Args('ticketId', { type: () => ID }) ticketId: string,
  ): Promise<boolean> {
    await this.ticketWrite.delete(ticketId);
    return true;
  }
}
