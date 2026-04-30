import { ScanVerdict } from '../models/enums/scan-verdict.enum.js';
import { ActivateDeviceInput } from '../models/inputs/activate-device.input.js';
import { mapScanLog } from '../models/mapper/scan-logs.mapper.js';
import { mapTicket } from '../models/mapper/ticket.mapper.js';
import { ScanLogPayload } from '../models/payloads/scan-log-list.payload.js';
import {
  TicketMessagePayload,
  TicketPayload,
} from '../models/payloads/ticket-payload.js';
import { ScanService } from '../service/scan.service.js';
import { TicketWriteService } from '../service/ticket-write.service.js';
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
import { ClientInfo } from '@omnixys/context';
import {
  CookieAuthGuard,
  CurrentUser,
  CurrentUserData,
} from '@omnixys/security';
import { ClientContext } from '@omnixys/shared';

@InputType()
export class RevokeTicketInput implements RevokeTicketDTO {
  @Field(() => ID)
  ticketId!: string;

  @Field(() => String, { nullable: true })
  reason?: string;
}

export interface RevokeTicketDTO {
  ticketId: string;
  reason?: string;
}

@ObjectType()
export class ScanPayload {
  @Field(() => TicketPayload)
  ticket!: TicketPayload;
  @Field(() => ScanLogPayload)
  log!: ScanLogPayload;
  @Field(() => ScanVerdict)
  verdict!: ScanVerdict;
  @Field(() => String)
  message!: string;
}

@InputType()
export class ScanInput {
  @Field(() => String)
  token!: string;

  @Field(() => String)
  signature!: string;

  @Field(() => String)
  deviceId!: string;

  @Field(() => String, { nullable: true })
  gate?: string;
}

@Resolver(() => TicketMessagePayload)
export class TicketMutationResolver {
  constructor(
    private readonly ticketWrite: TicketWriteService,
    private readonly scan: ScanService,
  ) {}

  @Mutation(() => TicketPayload, {
    description: 'Bind a device to a ticket (first activation)',
  })
  @UseGuards(CookieAuthGuard)
  async activateDevice(
    @Args('input') input: ActivateDeviceInput,
    @ClientInfo() info: ClientContext,
  ): Promise<TicketPayload> {
    return this.ticketWrite.activateDevice({ ...input, ip: info.ip });
  }

  @Mutation(() => String, {
    description: 'Rotate nonce for a ticket’s QR token',
  })
  async generateToken(
    @Args('ticketId', { type: () => ID })
    ticketId: string,
  ): Promise<string> {
    return this.ticketWrite.generateToken(ticketId);
  }

  @Mutation(() => ScanPayload)
  @UseGuards(CookieAuthGuard)
  async scanToken(
    @Args('input') input: ScanInput,
    @CurrentUser() user: CurrentUserData,
  ): Promise<ScanPayload> {
    const { token, signature, deviceId, gate } = input;

    const result = await this.scan.scan({
      token,
      signature,
      deviceId,
      gate,
      actorId: user.id,
    });

    return {
      ticket: mapTicket(result.ticket),
      log: mapScanLog(result.log),
      verdict: result.verdict as ScanVerdict,
      message: result.message,
    };
  }

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

  // ---------------------------------------------------------
  // 4) Revoke a ticket manually
  // ---------------------------------------------------------
  @UseGuards(CookieAuthGuard)
  @Mutation(() => TicketPayload, {
    description: 'Revoke a ticket (security or admin)',
  })
  async revokeTicket(
    @CurrentUser() user: CurrentUserData,
    @Args('input', { type: () => RevokeTicketInput }) input: RevokeTicketInput,
  ): Promise<TicketPayload> {
    const { ticketId, reason } = input;
    return this.ticketWrite.revoke({ ticketId, reason, actorId: user.id });
  }
}
