import { AnalyticsOutboxService } from '../../analytics/analytics-outbox.service.js';
import { env } from '../../config/env.js';
import { ScanLog, ScanVerdict, Ticket } from '../../prisma/generated/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { VerifyService } from './verify.service.js';
import { Injectable } from '@nestjs/common';
import { ContextAccessor } from '@omnixys/context-ts';
import { EventPermissionKey, type EventMilestoneRecordedDTO } from '@omnixys/contracts-ts';
import { KafkaProducerService, KafkaTopics } from '@omnixys/kafka-ts';
import { OmnixysLogger } from '@omnixys/logger-ts';
import { EventAccessDeniedException, EventPermissionResolver } from '@omnixys/security-ts';

const { DEFAULT_TENANT_ID } = env;

export interface SecurityScanInput {
  token: string;
  signature: string;
  deviceId: string;
  gate?: string;
  actorId: string;
}

export interface ScanPayloadDTO {
  ticket: Ticket;
  log: ScanLog;
  verdict: ScanVerdict;
  message: string;
}

@Injectable()
export class ScanService {
  private readonly logger;

  constructor(
    private readonly prisma: PrismaService,
    private readonly verify: VerifyService,
    private readonly producer: KafkaProducerService,
    private readonly eventPermissionResolver: EventPermissionResolver,
    logger: OmnixysLogger,
    private readonly analyticsOutbox: AnalyticsOutboxService,
  ) {
    this.logger = logger.log(this.constructor.name);
  }

  async scan({
    token,
    signature,
    deviceId,
    gate,
    actorId,
  }: SecurityScanInput): Promise<ScanPayloadDTO> {
    const result = await this.prisma.$transaction(async (tx) => {
      const { ticket, payload, verdict, message } = await this.verify.verifyToken(
        token,
        signature,
        deviceId,
        tx,
      );
      const permissions = await this.eventPermissionResolver.getPermissionsForUser(
        actorId,
        ticket.eventId,
      );
      if (!permissions.includes(EventPermissionKey.ScanTickets)) {
        throw new EventAccessDeniedException({
          eventId: ticket.eventId,
          userId: actorId,
          reason: 'event-permission-mismatch',
          actualPermissions: permissions,
          requiredPermissions: [EventPermissionKey.ScanTickets],
        });
      }
      const log = await tx.scanLog.create({
        data: {
          ticketId: ticket.id,
          eventId: ticket.eventId,
          direction: ticket.currentState,
          verdict,
          nonce: payload.dn,
          gate,
          actorId,
          deviceId,
        },
      });
      await this.analyticsOutbox.enqueue(
        tx,
        verdict === ScanVerdict.OK ? 'ticket.scan.succeeded.v1' : 'ticket.scan.rejected.v1',
        {
          eventName: verdict === ScanVerdict.OK ? 'QrScanSucceeded' : 'QrScanRejected',
          aggregateId: ticket.id,
          aggregateType: 'Ticket',
          subjectId: ticket.guestProfileId,
          properties: {
            ticketId: ticket.id,
            eventId: ticket.eventId,
            verdict,
            direction: ticket.currentState,
            hasGate: Boolean(gate),
          },
        },
      );
      if (verdict === ScanVerdict.OK) {
        const checkedIn = ticket.currentState === 'INSIDE';
        await this.analyticsOutbox.enqueue(
          tx,
          checkedIn ? 'ticket.guest.checked-in.v1' : 'ticket.guest.checked-out.v1',
          {
            eventName: checkedIn ? 'GuestCheckedIn' : 'GuestCheckedOut',
            aggregateId: ticket.id,
            aggregateType: 'Ticket',
            subjectId: ticket.guestProfileId,
            properties: {
              ticketId: ticket.id,
              eventId: ticket.eventId,
            },
          },
        );
      }
      return { ticket, payload, verdict, message, log };
    });
    const { ticket, verdict, message, log } = result;

    if (verdict === ScanVerdict.OK) {
      await this.publishMilestone(
        {
          eventId: ticket.eventId,
          milestoneId: `${log.id}:scanned`,
          type: 'TICKET_SCANNED',
          label: gate ? `Ticket scanned at ${gate}` : 'Ticket scanned',
          occurredAt: log.createdAt.toISOString(),
          referenceId: ticket.id,
        },
        actorId,
      );
    }

    return { ticket, log, verdict, message };
  }

  private async publishMilestone(
    payload: EventMilestoneRecordedDTO,
    actorId: string,
  ): Promise<void> {
    const context = ContextAccessor.get();
    try {
      await this.producer.send({
        topic: KafkaTopics.event.milestoneRecorded,
        payload,
        meta: {
          service: 'ticket-service',
          operation: 'Record Event Milestone',
          version: '1',
          type: 'EVENT',
          actorId,
          tenantId: context?.tenant?.tenantId ?? context?.principal?.tenantId ?? DEFAULT_TENANT_ID,
        },
      });
    } catch (error) {
      this.logger.error('Failed to publish ticket scan milestone', {
        error,
        eventId: payload.eventId,
        ticketId: payload.referenceId,
      });
    }
  }
}
