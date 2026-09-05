import { AnalyticsOutboxService } from '../../analytics/analytics-outbox.service.js';
import { env } from '../../config/env.js';
import { PresenceState } from '../../prisma/generated/client.js';
import type { ScanLogUncheckedCreateInput } from '../../prisma/generated/models/ScanLog.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  TicketAccessDeniedException,
  TicketAlreadyExistsException,
  TicketDeviceAlreadyBoundException,
  TicketDeviceKeyInvalidException,
  TicketNonceUninitializedException,
  TicketNotFoundException,
} from '../errors/ticket-domain.error.js';
import { ScanVerdict } from '../models/enums/scan-verdict.enum.js';
import { ActivateDeviceDTO } from '../models/inputs/activate-device.input.js';
import { mapTicket } from '../models/mapper/ticket.mapper.js';
import { TicketPayload } from '../models/payloads/ticket-payload.js';
import { TokenService } from './token.service.js';
import { Injectable } from '@nestjs/common';
import { ContextAccessor } from '@omnixys/context-ts';
import { EventPermissionKey, type EventMilestoneRecordedDTO } from '@omnixys/contracts-ts';
import { KafkaProducerService, KafkaTopics } from '@omnixys/kafka-ts';
import { OmnixysLogger } from '@omnixys/logger-ts';
import { TraceRunner } from '@omnixys/observability-ts';
import { EventAccessDeniedException, EventPermissionResolver } from '@omnixys/security-ts';
import { createPublicKey } from 'node:crypto';

const { DEFAULT_TENANT_ID } = env;

export interface UpdateTicketInput {
  id: string;
  revoked?: boolean;
  currentState?: PresenceState;
  seatId: string;
}

@Injectable()
export class TicketWriteService {
  private readonly logger;

  constructor(
    private readonly prisma: PrismaService,
    private readonly loggerService: OmnixysLogger,
    private readonly token: TokenService,
    private readonly producer: KafkaProducerService,
    private readonly eventPermissionResolver: EventPermissionResolver,
    private readonly analyticsOutbox: AnalyticsOutboxService,
  ) {
    this.logger = this.loggerService.log(this.constructor.name, 'service:ticket');
  }

  async createTicket(data: {
    eventId: string;
    invitationId: string;
    userId: string;
    seatId: string;
    actorId: string;
  }): Promise<TicketPayload> {
    return TraceRunner.run('[SERVICE] createTicket', async () => {
      const existing = await this.prisma.ticket.findUnique({
        where: { invitationId: data.invitationId },
      });

      if (existing) {
        if (
          existing.eventId !== data.eventId ||
          existing.guestProfileId !== data.userId ||
          existing.seatId !== data.seatId
        ) {
          throw new TicketAlreadyExistsException(data.invitationId);
        }

        await this.publishMilestone({
          eventId: existing.eventId,
          milestoneId: `${existing.id}:generated`,
          type: 'TICKET_GENERATED',
          label: 'Ticket generated',
          occurredAt: existing.createdAt.toISOString(),
          referenceId: existing.id,
        });
        return mapTicket(existing);
      }

      const created = await this.prisma.$transaction(async (tx) => {
        const result = await tx.ticket.create({
          data: {
            eventId: data.eventId,
            invitationId: data.invitationId,
            guestProfileId: data.userId,
            seatId: data.seatId,
            nextNonce: 1,
          },
        });
        await this.analyticsOutbox.enqueue(tx, 'ticket.generated.v1', {
          eventName: 'TicketGenerated',
          aggregateId: result.id,
          aggregateType: 'Ticket',
          subjectId: result.guestProfileId,
          properties: {
            ticketId: result.id,
            eventId: result.eventId,
            hasSeat: Boolean(result.seatId),
          },
        });
        return result;
      });

      await this.publishMilestone({
        eventId: created.eventId,
        milestoneId: `${created.id}:generated`,
        type: 'TICKET_GENERATED',
        label: 'Ticket generated',
        occurredAt: created.createdAt.toISOString(),
        referenceId: created.id,
      });

      return mapTicket(created);
    });
  }

  async update(input: UpdateTicketInput): Promise<void> {
    await this.ensureExists(input.id);

    await this.prisma.ticket.update({
      where: { id: input.id },
      data: {
        revoked: input.revoked,
        currentState: input.currentState,
        seatId: input.seatId,
      },
    });
  }

  async activateDevice(input: ActivateDeviceDTO, actorId: string): Promise<TicketPayload> {
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({
        where: { id: input.ticketId },
      });

      if (!ticket) {
        throw new TicketNotFoundException(input.ticketId);
      }

      if (ticket.guestProfileId !== actorId) {
        throw new TicketAccessDeniedException(input.ticketId, 'device-binding-owner-mismatch');
      }

      if (ticket.devicePublicKey) {
        if (ticket.devicePublicKey !== input.publicKey || ticket.deviceId !== input.deviceId) {
          throw new TicketDeviceAlreadyBoundException(input.ticketId);
        }
        return mapTicket(ticket);
      }

      this.assertValidDeviceKey(input.ticketId, input.publicKey);

      const updated = await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          devicePublicKey: input.publicKey,
          deviceId: input.deviceId,
          deviceActivationAt: new Date(),
          deviceActivationIP: input.ip,
        },
      });

      return mapTicket(updated);
    });
  }

  async generateToken(ticketId: string, actorId: string): Promise<string> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new TicketNotFoundException(ticketId);
    }

    if (ticket.guestProfileId !== actorId) {
      throw new TicketAccessDeniedException(ticketId, 'token-owner-mismatch');
    }

    if (ticket.nextNonce === null) {
      throw new TicketNonceUninitializedException(ticketId);
    }

    return this.token.generate({
      tid: ticket.id,
      eid: ticket.eventId,
      gid: ticket.guestProfileId,
      sid: ticket.seatId,
      dn: ticket.nextNonce,
      ts: Date.now(),
      dh: ticket.deviceId ? this.token.hashDevice(ticket.deviceId) : undefined,
    });
  }

  async delete(ticketId: string, actorId: string): Promise<void> {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      throw new TicketNotFoundException(ticketId);
    }

    await this.assertManageTicket(ticket.eventId, actorId);

    await this.prisma.$transaction(async (tx) => {
      await tx.scanLog.deleteMany({ where: { ticketId } });
      await tx.shareGuard.deleteMany({ where: { ticketId } });
      await tx.ticket.delete({ where: { id: ticketId } });
    });
  }

  async deleteByEventIds(eventIds: string[]): Promise<void> {
    return TraceRunner.run('[SERVICE] deleteByEventIds', async () => {
      this.logger.warn('Delete tickets for events=%o', eventIds);

      if (!eventIds?.length) {
        this.logger.warn('deleteByEventIds skipped → empty input');
        return;
      }

      const count = await this.prisma.$transaction(async (tx) => {
        /**
         * 1. Get affected ticketIds
         */
        const tickets = await tx.ticket.findMany({
          where: {
            eventId: { in: eventIds },
          },
          select: { id: true },
        });

        const ticketIds = tickets.map((t) => t.id);

        if (ticketIds.length === 0) {
          this.logger.warn('No tickets found for events=%o', eventIds);
          return;
        }

        /**
         * 2. Delete dependent data first
         */
        await tx.scanLog.deleteMany({
          where: {
            ticketId: { in: ticketIds },
          },
        });

        await tx.shareGuard.deleteMany({
          where: {
            ticketId: { in: ticketIds },
          },
        });

        /**
         * 3. Delete tickets
         */
        const count = await tx.ticket.deleteMany({
          where: {
            id: { in: ticketIds },
          },
        });
        return count;
      });

      this.logger.info('Tickets deleted for events=%o count=%s', eventIds, count);
    });
  }

  async deleteByGuestId(guestId: string): Promise<void> {
    return TraceRunner.run('[SERVICE] deleteByGuestId', async () => {
      this.logger.warn('Delete tickets for guestId=%s', guestId);

      if (!guestId) {
        this.logger.warn('deleteByGuestId skipped → no guestId');
        return;
      }

      await this.prisma.$transaction(async (tx) => {
        const tickets = await tx.ticket.findMany({
          where: {
            guestProfileId: guestId,
          },
          select: { id: true },
        });

        const ticketIds = tickets.map((t) => t.id);

        if (ticketIds.length === 0) {
          this.logger.warn('No tickets found for guestId=%s', guestId);
          return;
        }

        await tx.scanLog.deleteMany({
          where: {
            ticketId: { in: ticketIds },
          },
        });

        await tx.shareGuard.deleteMany({
          where: {
            ticketId: { in: ticketIds },
          },
        });

        await tx.ticket.deleteMany({
          where: {
            id: { in: ticketIds },
          },
        });
      });

      this.logger.info('Tickets deleted for guestId=%s', guestId);
    });
  }

  private async ensureExists(id: string): Promise<TicketPayload> {
    const found = await this.prisma.ticket.findUnique({ where: { id } });

    if (!found) {
      throw new TicketNotFoundException(id);
    }

    return mapTicket(found);
  }

  async revoke({
    ticketId,
    reason,
    actorId,
  }: {
    ticketId: string;
    reason?: string;
    actorId: string;
  }): Promise<TicketPayload> {
    const now = new Date();
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      throw new TicketNotFoundException(ticketId);
    }

    await this.assertManageTicket(ticket.eventId, actorId);

    if (ticket.revoked) {
      await this.publishRevokedMilestone(ticket);
      return mapTicket(ticket);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.ticket.update({
        where: { id: ticketId },
        data: {
          revoked: true,
          currentState: 'OUTSIDE',
          revokedAt: now,
          revokedBy: actorId,
          revokedReason: reason ?? 'Manual revoke',
        },
      });
      const scanLogData: ScanLogUncheckedCreateInput = {
        ticketId,
        eventId: ticket.eventId,
        direction: PresenceState.OUTSIDE,
        verdict: ScanVerdict.REVOKED,
        actorId,
      };
      await tx.scanLog.create({ data: scanLogData });
      await this.analyticsOutbox.enqueue(tx, 'ticket.revoked.v1', {
        eventName: 'TicketRevoked',
        aggregateId: ticketId,
        aggregateType: 'Ticket',
        subjectId: ticket.guestProfileId,
        properties: {
          ticketId,
          eventId: ticket.eventId,
        },
      });
      return result;
    });

    await this.publishRevokedMilestone(updated);

    return mapTicket(updated);
  }

  private async publishRevokedMilestone(ticket: {
    id: string;
    eventId: string;
    revokedAt: Date | null;
    updatedAt: Date | null;
  }): Promise<void> {
    await this.publishMilestone({
      eventId: ticket.eventId,
      milestoneId: `${ticket.id}:revoked`,
      type: 'TICKET_REVOKED',
      label: 'Ticket revoked',
      occurredAt: (ticket.revokedAt ?? ticket.updatedAt ?? new Date()).toISOString(),
      referenceId: ticket.id,
    });
  }

  private async publishMilestone(payload: EventMilestoneRecordedDTO): Promise<void> {
    const context = ContextAccessor.get();
    await this.producer.send({
      topic: KafkaTopics.event.milestoneRecorded,
      payload,
      meta: {
        service: 'ticket-service',
        operation: 'Record Event Milestone',
        version: '1',
        type: 'EVENT',
        actorId: context?.principal?.actorId,
        tenantId: context?.tenant?.tenantId ?? context?.principal?.tenantId ?? DEFAULT_TENANT_ID,
      },
    });
  }

  private assertValidDeviceKey(ticketId: string, publicKeyBase64: string): void {
    try {
      const key = createPublicKey({
        key: Buffer.from(publicKeyBase64, 'base64'),
        format: 'der',
        type: 'spki',
      });
      if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') {
        throw new TypeError('Unexpected device key algorithm');
      }
    } catch {
      throw new TicketDeviceKeyInvalidException(ticketId);
    }
  }

  private async assertManageTicket(eventId: string, actorId: string): Promise<void> {
    const permissions = await this.eventPermissionResolver.getPermissionsForUser(actorId, eventId);

    if (!permissions.includes(EventPermissionKey.ManageTickets)) {
      throw new EventAccessDeniedException({
        eventId,
        userId: actorId,
        reason: 'event-permission-mismatch',
        actualPermissions: permissions,
        requiredPermissions: [EventPermissionKey.ManageTickets],
      });
    }
  }
}
