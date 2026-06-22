/**
 * @license GPL-3.0-or-later
 * Copyright (C) 2025 Caleb Gyamfi - Omnixys Technologies
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * For more information, visit <https://www.gnu.org/licenses/>.
 */

import { env } from '../config/env.js';
import { TicketVerificationTokenException } from '../ticket/errors/ticket-domain.error.js';
import { TicketWriteService } from '../ticket/service/ticket-write.service.js';
import { Injectable } from '@nestjs/common';
import { ValkeyKey, ValkeyService } from '@omnixys/cache';
import { ContextAccessor } from '@omnixys/context';
import type {
  CreateUserWithInvitationIdDTO,
  GuestTicketKey,
} from '@omnixys/contracts';
import {
  KafkaEvent,
  KafkaEventHandler,
  KafkaTopics,
  KafkaProducerService,
  type EventType,
} from '@omnixys/kafka';
import { OmnixysLogger } from '@omnixys/logger';
import { TraceRunner } from '@omnixys/observability';

const { SERVICE } = env;

interface KafkaMeta {
  actorId: string;
  tenantId: string;
  service: string;
  operation: string;
  version: string;
  type: EventType;
}

/**
 * Kafka event handler responsible for useristrative commands such as
 * shutdown and restart. It listens for specific user-related topics
 * and delegates the actual process control logic to the {@link UserService}.
 *
 * @category Messaging
 * @since 1.0.0
 */
@KafkaEventHandler('seat')
@Injectable()
export class SeatHandler {
  private readonly logger;

  /**
   * Creates a new instance of {@link SeatHandler}.
   *
   * @param loggerService - The central logger service used for structured logging.
   * @param userService - The service responsible for handling system-level user operations.
   */
  constructor(
    private readonly omnixysLogger: OmnixysLogger,
    private readonly ticketWriteService: TicketWriteService,
    private readonly cache: ValkeyService,
    private readonly kafkaProducer: KafkaProducerService,
  ) {
    this.logger = this.omnixysLogger.log(this.constructor.name);
  }

  @KafkaEvent(KafkaTopics.ticket.create)
  async handleCreateTicket(
    payload: CreateUserWithInvitationIdDTO,
  ): Promise<void> {
    return TraceRunner.run('[HANDLER] createTicket', async () => {
      this.logger.debug('create ticket Handler');
      const { token, invitationId, userId } = payload;

      const raw = await this.cache.get(
        ValkeyKey.guestVerificationTicket,
        token,
      );
      if (!raw) {
        throw new TicketVerificationTokenException('invalid-token');
      }

      const input = this.parseGuestTicketKey(raw);

      const ticket = input.tickets.find((t) => t.invitationId === invitationId);

      if (!ticket) {
        throw new TicketVerificationTokenException('mapping-not-found', {
          invitationId,
        });
      }

      await this.ticketWriteService.createTicket({
        eventId: input.eventId,
        invitationId,
        userId,
        seatId: ticket.seatId,
        actorId: input.actorId,
      });

      /**
       * Final link back to invitation
       */
      await this.kafkaProducer.send({
        topic: KafkaTopics.invitation.addGuestId,
        payload: {
          userId,
          invitationId,
          actorId: input.actorId,
        },
        meta: this.meta(input.actorId, 'Link invitation to guest'),
      });
    });
  }

  /**
   * Standard Kafka metadata builder.
   */
  private meta(actorId: string, operation: string): KafkaMeta {
    const context = ContextAccessor.get();
    const type: EventType = 'EVENT';
    return {
      actorId: context?.principal?.actorId ?? actorId,
      tenantId:
        context?.tenant?.tenantId ?? context?.principal?.tenantId ?? 'omnixys',
      service: SERVICE,
      operation,
      version: '1',
      type,
    };
  }

  private parseGuestTicketKey(raw: string): GuestTicketKey {
    try {
      const value = JSON.parse(raw) as Partial<GuestTicketKey>;
      if (
        typeof value.eventId !== 'string' ||
        typeof value.actorId !== 'string' ||
        !Array.isArray(value.tickets) ||
        value.tickets.some(
          (ticket) =>
            typeof ticket?.invitationId !== 'string' ||
            typeof ticket?.seatId !== 'string',
        )
      ) {
        throw new TypeError('Guest ticket payload has an invalid shape');
      }
      return value as GuestTicketKey;
    } catch (cause) {
      throw new TicketVerificationTokenException(
        'invalid-token',
        cause instanceof Error ? { cause: cause.message } : {},
      );
    }
  }
}
