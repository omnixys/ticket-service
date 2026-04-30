import { DevService } from './dev.service.js';
import { Body, Controller, Get, Param, Post } from '@nestjs/common';

@Controller('dev')
export class DevController {
  constructor(private readonly dev: DevService) {}

  // ---------------------------------------------------
  // CREATE TICKET (DEV)
  // ---------------------------------------------------
  @Post('ticket/create')
  async createTicket(
    @Body()
    body: {
      eventId: string;
      invitationId: string;
      guestProfileId: string;
      seatId: string;
    },
  ): ReturnType<DevService['createTicket']> {
    return this.dev.createTicket(body);
  }

  // ---------------------------------------------------
  // Decode token (JWE + JWS)
  // ---------------------------------------------------
  @Post('decode')
  async decode(@Body() body: { token: string }): ReturnType<DevService['decodeToken']> {
    return this.dev.decodeToken(body.token);
  }

  // ---------------------------------------------------
  // Sign token (simulate client)
  // ---------------------------------------------------
  @Post('sign')
  async sign(
    @Body()
    body: {
      token: string;
      deviceId: string;
      privateKey: string;
    },
  ): ReturnType<DevService['signToken']> {
    return this.dev.signToken(body.token, body.deviceId, body.privateKey);
  }

  // ---------------------------------------------------
  // Replay keys
  // ---------------------------------------------------
  @Get('replay/:ticketId')
  async replay(@Param('ticketId') ticketId: string): ReturnType<DevService['getReplayKeys']> {
    return this.dev.getReplayKeys(ticketId);
  }

  // ---------------------------------------------------
  // Reset replay keys
  // ---------------------------------------------------
  @Post('replay/reset/:ticketId')
  async resetReplay(@Param('ticketId') ticketId: string): ReturnType<DevService['resetReplay']> {
    return this.dev.resetReplay(ticketId);
  }

  // ---------------------------------------------------
  // Reset ticket state
  // ---------------------------------------------------
  @Post('ticket/reset/:ticketId')
  async resetTicket(@Param('ticketId') ticketId: string): ReturnType<DevService['resetTicket']> {
    return this.dev.resetTicket(ticketId);
  }

  // ---------------------------------------------------
  // Full debug snapshot
  // ---------------------------------------------------
  @Get('ticket/:ticketId')
  async debugTicket(@Param('ticketId') ticketId: string): ReturnType<DevService['getTicketDebug']> {
    return this.dev.getTicketDebug(ticketId);
  }

  @Get('keys')
  generateKeys(): ReturnType<DevService['generateKeyPair']> {
    return this.dev.generateKeyPair();
  }

  @Get('secrets')
  getSecrets(): ReturnType<DevService['generateSecrets']> {
    return this.dev.generateSecrets();
  }
}
