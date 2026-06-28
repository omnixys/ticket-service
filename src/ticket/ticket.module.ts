import { PrismaModule } from '../prisma/prisma.module.js';
import { TicketMutationResolver } from './resolvers/ticket-mutation.resolver.js';
import { TicketQueryResolver } from './resolvers/ticket-query.resolver.js';
import { ScanService } from './service/scan.service.js';
import { ShareGuardService } from './service/shareguard.service.js';
import { TicketEventRoleResolver } from './service/ticket-event-role-resolver.service.js';
import { TicketReadService } from './service/ticket-read.service.js';
import { TicketWriteService } from './service/ticket-write.service.js';
import { TokenService } from './service/token.service.js';
import { VerifyService } from './service/verify.service.js';
import { Module } from '@nestjs/common';
import { EventRoleGuard, EventRoleResolver } from '@omnixys/security';

@Module({
  imports: [PrismaModule],
  providers: [
    TicketReadService,
    TicketWriteService,
    TicketQueryResolver,
    TicketMutationResolver,
    TokenService,
    ScanService,
    ShareGuardService,
    VerifyService,
    EventRoleGuard,
    TicketEventRoleResolver,
    {
      provide: EventRoleResolver,
      useExisting: TicketEventRoleResolver,
    },
  ],
  exports: [TicketReadService, TicketWriteService, TokenService],
})
export class TicketModule {}
