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
import type {
  EventIdsDTO,
  EventOwnerChangedDTO,
  EventRoleAssignedDTO,
  EventRoleRemovedDTO,
} from '@omnixys/contracts';
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
export class EventRoleHandler {
  private readonly logger;

  constructor(
    private readonly omnixysLogger: OmnixysLogger,
    private readonly prisma: PrismaService,
  ) {
    this.logger = this.omnixysLogger.log(this.constructor.name);
  }

  @KafkaEvent(KafkaTopics.event.roleAssigned)
  async handleRoleAssigned(
    payload: EventRoleAssignedDTO,
    _context: IKafkaEventContext,
  ): Promise<void> {
    return TraceRunner.run('[HANDLER] event.roleAssigned', async () => {
      const { eventId, userId, role, occurredAt } = payload;

      const existing = await this.prisma.eventRoleProjection.findUnique({
        where: { uq_event_role_projection: { eventId, userId } },
        select: { updatedAt: true },
      });

      if (
        existing?.updatedAt &&
        new Date(occurredAt).getTime() < existing.updatedAt.getTime()
      ) {
        this.logger.debug('Skipping stale event.roleAssigned', {
          eventId,
          userId,
        });
        return;
      }

      await this.prisma.eventRoleProjection.upsert({
        where: { uq_event_role_projection: { eventId, userId } },
        create: { eventId, userId, role },
        update: { role },
      });
    });
  }

  @KafkaEvent(KafkaTopics.event.roleRemoved)
  async handleRoleRemoved(
    payload: EventRoleRemovedDTO,
    _context: IKafkaEventContext,
  ): Promise<void> {
    return TraceRunner.run('[HANDLER] event.roleRemoved', async () => {
      const { eventId, userId, occurredAt } = payload;

      const existing = await this.prisma.eventRoleProjection.findUnique({
        where: { uq_event_role_projection: { eventId, userId } },
        select: { updatedAt: true },
      });

      if (
        existing?.updatedAt &&
        new Date(occurredAt).getTime() < existing.updatedAt.getTime()
      ) {
        this.logger.debug('Skipping stale event.roleRemoved', {
          eventId,
          userId,
        });
        return;
      }

      await this.prisma.eventRoleProjection.deleteMany({
        where: { eventId, userId },
      });
    });
  }

  @KafkaEvent(KafkaTopics.event.ownerChanged)
  async handleOwnerChanged(
    payload: EventOwnerChangedDTO,
    _context: IKafkaEventContext,
  ): Promise<void> {
    return TraceRunner.run('[HANDLER] event.ownerChanged', async () => {
      const { eventId, oldOwnerId, newOwnerId, occurredAt } = payload;

      if (oldOwnerId) {
        const existing = await this.prisma.eventRoleProjection.findUnique({
          where: { uq_event_role_projection: { eventId, userId: oldOwnerId } },
          select: { updatedAt: true },
        });

        if (
          !existing?.updatedAt ||
          new Date(occurredAt).getTime() >= existing.updatedAt.getTime()
        ) {
          await this.prisma.eventRoleProjection.deleteMany({
            where: { eventId, userId: oldOwnerId },
          });
        }
      }

      const existingNew = await this.prisma.eventRoleProjection.findUnique({
        where: { uq_event_role_projection: { eventId, userId: newOwnerId } },
        select: { updatedAt: true },
      });

      if (
        existingNew?.updatedAt &&
        new Date(occurredAt).getTime() < existingNew.updatedAt.getTime()
      ) {
        this.logger.debug('Skipping stale ownerChanged upsert', {
          eventId,
          userId: newOwnerId,
        });
        return;
      }

      await this.prisma.eventRoleProjection.upsert({
        where: { uq_event_role_projection: { eventId, userId: newOwnerId } },
        create: { eventId, userId: newOwnerId, role: 'ADMIN' },
        update: { role: 'ADMIN' },
      });
    });
  }

  @KafkaEvent(KafkaTopics.event.deleted)
  async handleEventDeleted(
    payload: EventIdsDTO,
    _context: IKafkaEventContext,
  ): Promise<void> {
    return TraceRunner.run('[HANDLER] event.deleted', async () => {
      await this.prisma.eventRoleProjection.deleteMany({
        where: { eventId: { in: payload.eventIds } },
      });
    });
  }
}
