import { Injectable } from '@nestjs/common';
import { Kafka } from 'kafkajs';
import { PrismaService } from '../../prisma/prisma.service.js';
import { VerifyService } from './verify.service.js';
import { ScanLog, ScanVerdict, Ticket } from '../../prisma/generated/client.js';

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
  private readonly kafka = new Kafka({ brokers: ['localhost:9092'] });
  private readonly producer = this.kafka.producer();

  constructor(
    private readonly prisma: PrismaService,
    private readonly verify: VerifyService,
  ) {}

  async scan({token, signature, deviceId, gate, actorId}: SecurityScanInput): Promise<ScanPayloadDTO>  {
    const { ticket, payload, verdict, message } = await this.verify.verifyToken(token, signature, deviceId);

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

    await this.producer.connect();
    await this.producer.send({
      topic: 'ticket.scanned',
      messages: [
        {
          value: JSON.stringify({
            ticketId: ticket.id,
            eventId: ticket.eventId,
            verdict,
            gate,
            timestamp: Date.now(),
          }),
        },
      ],
    });

    return { ticket, log, verdict, message };
  }
}
