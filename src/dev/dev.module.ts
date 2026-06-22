import { TicketModule } from '../ticket/ticket.module.js';
import { DevController } from './dev.controller.js';
import { DevService } from './dev.service.js';
import { Module } from '@nestjs/common';

@Module({
  imports: [TicketModule],
  controllers: [DevController],
  providers: [DevService],
})
export class DevModule {}
