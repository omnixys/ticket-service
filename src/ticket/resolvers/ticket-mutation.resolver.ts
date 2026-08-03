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
import { ClientInfo } from '@omnixys/context-ts';
import type { ClientContext } from '@omnixys/context-ts';
import { RealmRoleType } from '@omnixys/contracts-ts';
import { getLogger } from '@omnixys/logger-ts';
import {
  CookieAuthGuard,
  CurrentUser,
  CurrentUserData,
  RoleGuard,
  Roles,
} from '@omnixys/security-ts';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

@InputType()
export class RevokeTicketInput implements RevokeTicketDTO {
  @Field(() => ID)
  @IsUUID()
  ticketId!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
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
  @IsString()
  @IsNotEmpty()
  token!: string;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  signature!: string;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  deviceId!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  gate?: string;
}

@Resolver(() => TicketMessagePayload)
@UseGuards(CookieAuthGuard)
export class TicketMutationResolver {
  readonly #logger = getLogger(TicketMutationResolver.name);

  constructor(
    private readonly ticketWrite: TicketWriteService,
    private readonly scan: ScanService,
  ) {}

  @Mutation(() => TicketPayload, {
    description: 'Bind a device to a ticket (first activation)',
  })
  async activateDevice(
    @Args('input') input: ActivateDeviceInput,
    @ClientInfo() info: ClientContext,
    @CurrentUser() user: CurrentUserData,
  ): Promise<TicketPayload> {
    this.#logger.debug(
      { ticketId: input.ticketId, userId: user.id },
      'activate_device',
    );
    return this.ticketWrite.activateDevice({ ...input, ip: info.ip }, user.id);
  }

  @Mutation(() => String, {
    description: 'Rotate nonce for a ticket’s QR token',
  })
  async generateToken(
    @Args('ticketId', { type: () => ID })
    ticketId: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<string> {
    this.#logger.debug({ ticketId, userId: user.id }, 'generate_token');
    return this.ticketWrite.generateToken(ticketId, user.id);
  }

  @Mutation(() => ScanPayload)
  @UseGuards(RoleGuard)
  @Roles(RealmRoleType.USER)
  async scanToken(
    @Args('input') input: ScanInput,
    @CurrentUser() user: CurrentUserData,
  ): Promise<ScanPayload> {
    const { token, signature, deviceId, gate } = input;

    this.#logger.debug({ gate, userId: user.id }, 'scan_token');
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
      verdict: result.verdict,
      message: result.message,
    };
  }

  @UseGuards(RoleGuard)
  @Roles(RealmRoleType.USER)
  @Mutation(() => Boolean, {
    description: 'Delete ticket and all its logs (admin only)',
  })
  async deleteTicket(
    @Args('ticketId', { type: () => ID }) ticketId: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<boolean> {
    await this.ticketWrite.delete(ticketId, user.id);
    return true;
  }

  // ---------------------------------------------------------
  // 4) Revoke a ticket manually
  // ---------------------------------------------------------
  @UseGuards(RoleGuard)
  @Roles(RealmRoleType.USER)
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
