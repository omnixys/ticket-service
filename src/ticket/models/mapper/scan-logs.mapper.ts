// src/ticket/models/mapper/scan-log.mapper.ts
import type { ScanLog } from '../../../prisma/generated/client.js';
import type { ScanLogPayload } from '../payloads/scan-log-list.payload.js';
import { n2u } from '@omnixys/contracts';

/**
 * Maps a Prisma ScanLog row → GraphQL ScanLog Entity.
 */
export function mapScanLog(row: ScanLog): ScanLogPayload {
  return {
    id: row.id,
    ticketId: row.ticketId,
    eventId: row.eventId,

    actorId: row.actorId,

    direction: row.direction,
    verdict: row.verdict,

    gate: n2u(row.gate ?? null),
    deviceId: n2u(row.deviceId),
    nonce: n2u(row.nonce ?? null),

    createdAt: row.createdAt,
  };
}

/**
 * Maps an array of Prisma ScanLog rows → GraphQL ScanLog Entities.
 */
export function mapScanLogs(rows: ScanLog[]): ScanLogPayload[] {
  return rows.map(mapScanLog);
}
