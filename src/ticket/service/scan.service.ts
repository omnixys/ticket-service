import { ScanLog, ScanVerdict, Ticket } from '../../prisma/generated/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { VerifyService } from './verify.service.js';
import { Injectable } from '@nestjs/common';
import { ContextAccessor } from '@omnixys/context';
import { EventPermissionKey, type EventMilestoneRecordedDTO } from '@omnixys/contracts';
import { KafkaProducerService, KafkaTopics } from '@omnixys/kafka';
import { OmnixysLogger } from '@omnixys/logger';
import { EventAccessDeniedException, EventPermissionResolver } from '@omnixys/security';

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
    const { ticket, payload, verdict, message } = await this.verify.verifyToken(
      token,
      signature,
      deviceId,
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

    const log = await this.prisma.scanLog.create({
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
          tenantId: context?.tenant?.tenantId ?? context?.principal?.tenantId ?? 'omnixys',
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
