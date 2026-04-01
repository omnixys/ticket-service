import { PrismaModule } from '../prisma/prisma.module.js';
import { TicketMutationResolver } from './resolvers/ticket-mutation.resolver.js';
import { TicketQueryResolver } from './resolvers/ticket-query.resolver.js';
import { TicketReadService } from './service/ticket-read.service.js';
import { TicketWriteService } from './service/ticket-write.service.js';
import { Module } from '@nestjs/common';

@Module({
  imports: [PrismaModule],
  providers: [TicketReadService, TicketWriteService, TicketQueryResolver, TicketMutationResolver],
  exports: [TicketReadService, TicketWriteService],
})
export class TicketModule {}
