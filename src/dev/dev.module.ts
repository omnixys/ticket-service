import { PrismaService } from '../prisma/prisma.service.js';
import { TokenService } from '../ticket/service/token.service.js';
import { DevController } from './dev.controller.js';
import { DevService } from './dev.service.js';
import { Module } from '@nestjs/common';
import { ValkeyService } from '@omnixys/cache';

@Module({
  controllers: [DevController],
  providers: [DevService, PrismaService, TokenService, ValkeyService],
})
export class DevModule {}
