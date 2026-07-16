import { PrismaService } from '../../prisma/prisma.service.js';
import { Injectable } from '@nestjs/common';
import {
  getDefaultPermissionsForEventRole,
  uniqueEventPermissions,
  type EventPermissionKey,
  type EventRoleType,
} from '@omnixys/contracts';
import { EventPermissionResolver, EventRoleResolver } from '@omnixys/security';

@Injectable()
export class TicketEventRoleResolver extends EventRoleResolver implements EventPermissionResolver {
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

  async getPermissionsForUser(
    userId: string,
    eventId: string,
  ): Promise<readonly EventPermissionKey[]> {
    const access = await this.prisma.eventAccessProjection.findUnique({
      where: {
        uq_event_access_projection: { eventId, userId },
      },
      select: { permissions: true },
    });

    if (access) {
      return uniqueEventPermissions(access.permissions);
    }

    const role = await this.getRoleForUser(userId, eventId);
    return getDefaultPermissionsForEventRole(role);
  }
}
