import type { Ticket } from '../../../prisma/generated/client.js';
import type { TicketPayload } from '../payloads/ticket-payload.js';
import { n2u } from '@omnixys/contracts';

/**
 * Maps a Prisma Ticket row → GraphQL Ticket Entity
 */
export function mapTicket(row: Ticket): TicketPayload {
  return {
    id: row.id,

    eventId: row.eventId,
    invitationId: row.invitationId,
    seatId: row.seatId ?? null,
    guestProfileId: row.guestProfileId ?? null,

    // --- Device Binding ---
    deviceId: n2u(row.deviceId),
    devicePublicKey: n2u(row.devicePublicKey),
    deviceActivationAt: n2u(row.deviceActivationAt),
    deviceActivationIP: n2u(row.deviceActivationIP),

    // --- Token Rotation ---
    lastNonce: n2u(row.lastNonce),
    nextNonce: n2u(row.nextNonce),

    // --- State ---
    currentState: row.currentState,
    checkedInAt: n2u(row.checkedInAt),

    revoked: row.revoked,
    revokedAt: n2u(row.revokedAt),
    revokedBy: n2u(row.revokedBy),
    revokedReason: n2u(row.revokedReason),

    // --- Timestamps ---
    createdAt: row.createdAt,
    updatedAt: n2u(row.updatedAt),
  };
}

/**
 * Maps an array of Prisma Ticket rows → GraphQL Ticket Entities
 */
export function mapTickets(rows: Ticket[]): TicketPayload[] {
  return rows.map(mapTicket);
}
