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

import { TicketWriteService } from '../ticket/service/ticket-write.service.js';
import { Injectable } from '@nestjs/common';
import type { UserIdDTO } from '@omnixys/contracts-ts';
import {
  IKafkaEventContext,
  KAFKA_HEADERS,
  KafkaEvent,
  KafkaEventHandler,
  KafkaTopics,
} from '@omnixys/kafka-ts';
import { OmnixysLogger, type ScopedLogger } from '@omnixys/logger-ts';
import { TraceRunner } from '@omnixys/observability-ts';

/**
 * Central Kafka Authentication Handler.
 *
 * Design principles:
 * - One class per domain (authentication)
 * - One method per Kafka topic
 * - Strict typing per method
 * - No switch/case
 * - No casting
 */
@KafkaEventHandler('authentication')
@Injectable()
export class AuthenticationHandler {
  private readonly logger: ScopedLogger;

  /**
   * Creates a new instance of {@link EventHandler}.
   *
   * @param loggerService - The central logger service used for structured logging.
   * @param userService - The service responsible for handling system-level user operations.
   */
  constructor(
    private readonly omnixysLogger: OmnixysLogger,
    private readonly ticketWriteService: TicketWriteService,
  ) {
    this.logger = this.omnixysLogger.log(
      'service:ticket',
      this.constructor.name,
    );
  }

  @KafkaEvent(KafkaTopics.ticket.deleteUserTickets)
  async handleDeleteTicketsByGuest(
    payload: UserIdDTO,
    context: IKafkaEventContext,
  ): Promise<void> {
    return TraceRunner.run('[HANDLER] handleDeleteTicketsByGuest', async () => {
      const headers = context.headers;
      const actorId = headers[KAFKA_HEADERS.ACTOR_ID] ?? 'unknown';

      this.logger.info('delete_tickets_by_guest_received: %o', {
        userId: payload.userId,
        actorId,
      });

      try {
        await this.ticketWriteService.deleteByGuestId(payload.userId);
        this.logger.info('delete_tickets_by_guest_success: %o', {
          userId: payload.userId,
        });
      } catch (error) {
        this.logger.error('delete_tickets_by_guest_failed: %o %o', error, {
          userId: payload.userId,
          actorId,
        });
        throw error;
      }
    });
  }
}
