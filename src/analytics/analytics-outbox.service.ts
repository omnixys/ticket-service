import type { Prisma } from '../prisma/generated/client.js';
import { Injectable } from '@nestjs/common';
import { ContextAccessor } from '@omnixys/context-ts';
import {
  AnalyticsDomainFactSchema,
  type AnalyticsDomainFact,
} from '@omnixys/contracts-ts/analytics';
import { isUUID } from 'class-validator';

@Injectable()
export class AnalyticsOutboxService {
  enqueue(
    tx: Prisma.TransactionClient,
    topic: string,
    fact: Omit<AnalyticsDomainFact, 'producer' | 'occurredAt'>,
  ): Promise<unknown> {
    const context = ContextAccessor.get();
    const tenantId = context?.tenant?.tenantId;
    if (!tenantId || !isUUID(tenantId)) {
      throw new Error('Verified UUID tenant context is required for analytics facts');
    }
    const payload = JSON.parse(
      JSON.stringify(
        AnalyticsDomainFactSchema.parse({
          producer: 'ticket',
          occurredAt: new Date().toISOString(),
          ...fact,
        }),
      ),
    ) as Prisma.InputJsonValue;
    return tx.analyticsOutbox.create({
      data: {
        tenantId,
        topic,
        correlationId: context?.correlationId,
        actorId: context?.principal?.actorId,
        payload,
      },
    });
  }
}
