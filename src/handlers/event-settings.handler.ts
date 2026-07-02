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

import { PrismaService } from '../prisma/prisma.service.js';
import { Injectable } from '@nestjs/common';
import type { EventCreatedDTO, EventUpdatedDTO } from '@omnixys/contracts';
import {
  KafkaEvent,
  KafkaEventHandler,
  KafkaTopics,
  type IKafkaEventContext,
} from '@omnixys/kafka';
import { OmnixysLogger } from '@omnixys/logger';
import { TraceRunner } from '@omnixys/observability';

@KafkaEventHandler('event')
@Injectable()
export class EventSettingsHandler {
  private readonly logger;

  constructor(
    private readonly omnixysLogger: OmnixysLogger,
    private readonly prisma: PrismaService,
  ) {
    this.logger = this.omnixysLogger.log(this.constructor.name);
  }

  @KafkaEvent(KafkaTopics.event.created)
  async handleEventCreated(
    payload: EventCreatedDTO,
    _context: IKafkaEventContext,
  ): Promise<void> {
    return TraceRunner.run('[HANDLER] event.created', async () => {
      const { eventId, name, endsAt, startsAt, ticketReleaseAt } = payload;

      await this.prisma.eventSettingsProjection.upsert({
        where: { eventId },
        create: {
          eventId,
          name,
          endsAt: endsAt ? new Date(endsAt) : null,
          startsAt: startsAt ? new Date(startsAt) : null,
          ticketReleaseAt: ticketReleaseAt ? new Date(ticketReleaseAt) : null,
        },
        update: {
          name,
          endsAt: endsAt ? new Date(endsAt) : null,
          startsAt: startsAt ? new Date(startsAt) : null,
          ticketReleaseAt: ticketReleaseAt ? new Date(ticketReleaseAt) : null,
        },
      });
    });
  }

  @KafkaEvent(KafkaTopics.event.updated)
  async handleEventUpdated(
    payload: EventUpdatedDTO,
    _context: IKafkaEventContext,
  ): Promise<void> {
    return TraceRunner.run('[HANDLER] event.updated', async () => {
      const { eventId, name, endsAt, startsAt, ticketReleaseAt, occurredAt } =
        payload;

      const existing = await this.prisma.eventSettingsProjection.findUnique({
        where: { eventId },
        select: { updatedAt: true },
      });

      if (
        existing?.updatedAt &&
        new Date(occurredAt).getTime() < existing.updatedAt.getTime()
      ) {
        this.logger.debug('Skipping stale event.updated', { eventId });
        return;
      }

      await this.prisma.eventSettingsProjection.upsert({
        where: { eventId },
        create: {
          eventId,
          name: name ?? null,
          endsAt: endsAt ? new Date(endsAt) : null,
          startsAt: startsAt ? new Date(startsAt) : null,
          ticketReleaseAt: ticketReleaseAt ? new Date(ticketReleaseAt) : null,
        },
        update: {
          name: name ?? undefined,
          endsAt:
            endsAt !== undefined
              ? endsAt
                ? new Date(endsAt)
                : null
              : undefined,
          startsAt:
            startsAt !== undefined
              ? startsAt
                ? new Date(startsAt)
                : null
              : undefined,
          ticketReleaseAt:
            ticketReleaseAt !== undefined
              ? ticketReleaseAt
                ? new Date(ticketReleaseAt)
                : null
              : undefined,
        },
      });
    });
  }
}
