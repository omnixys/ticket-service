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
import type { EventIdsDTO } from '@omnixys/contracts-ts';
import {
  KafkaEvent,
  KafkaEventHandler,
  KafkaTopics,
  IKafkaEventContext,
  KAFKA_HEADERS,
} from '@omnixys/kafka-ts';
import { OmnixysLogger, type ScopedLogger } from '@omnixys/logger-ts';
import { TraceRunner } from '@omnixys/observability-ts';

/**
 * Kafka event handler responsible for useristrative commands such as
 * shutdown and restart. It listens for specific user-related topics
 * and delegates the actual process control logic to the {@link UserService}.
 *
 * @category Messaging
 * @since 1.0.0
 */
@KafkaEventHandler('event')
@Injectable()
export class EventHandler {
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
      this.constructor.name,
    );
  }

  @KafkaEvent(KafkaTopics.ticket.deleteEventTickets)
  async handleDeleteTicketsByEventIds(
    payload: EventIdsDTO,
    context: IKafkaEventContext,
  ): Promise<void> {
    return TraceRunner.run(
      '[HANDLER] handleDeleteTicketsByEventIds',
      async () => {
        const headers = context.headers;
        const actorId = headers[KAFKA_HEADERS.ACTOR_ID] ?? 'unknown';

        this.logger.info('delete_tickets_by_events_received: %o', {
          eventIds: payload.eventIds,
          actorId,
        });

        try {
          await this.ticketWriteService.deleteByEventIds(payload.eventIds);
          this.logger.info('delete_tickets_by_events_success: %o', {
            eventIds: payload.eventIds,
          });
        } catch (error) {
          this.logger.error('delete_tickets_by_events_failed: %o %o', error, {
            eventIds: payload.eventIds,
            actorId,
          });
          throw error;
        }
      },
    );
  }
}
