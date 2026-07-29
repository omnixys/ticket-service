import { PrismaModule } from '../prisma/prisma.module.js';
import { AnalyticsOutboxPublisher } from './analytics-outbox.publisher.js';
import { AnalyticsOutboxService } from './analytics-outbox.service.js';
import { Module } from '@nestjs/common';

@Module({
  imports: [PrismaModule],
  providers: [AnalyticsOutboxService, AnalyticsOutboxPublisher],
  exports: [AnalyticsOutboxService],
})
export class AnalyticsModule {}
