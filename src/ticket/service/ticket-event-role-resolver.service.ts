import { PrismaService } from '../../prisma/prisma.service.js';
import { Injectable } from '@nestjs/common';
import type { EventRoleType } from '@omnixys/contracts';
import { EventRoleResolver } from '@omnixys/security';

@Injectable()
export class TicketEventRoleResolver extends EventRoleResolver {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async getRoleForUser(userId: string, eventId: string): Promise<EventRoleType | null> {
    const row = await this.prisma.eventRoleProjection.findUnique({
      where: {
        uq_event_role_projection: { eventId, userId },
      },
      select: { role: true },
    });

    return (row?.role as EventRoleType | null) ?? null;
  }
}
