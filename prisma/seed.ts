/* ----------------------------------------------------------------------
 * Prisma Seed – Omnixys Ticket Service
 * Author: Caleb Gyamfi
 * License: GPL-3.0-or-later
 * -------------------------------------------------------------------- */

import {
  PresenceState,
  PrismaClient,
  ScanVerdict,
} from '../src/prisma/generated/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

/* ----------------------------------------------------------------------
 * Constants
 * -------------------------------------------------------------------- */
  const EVENT_ID = '70911c35-5ea8-4ce2-bf95-ebcc5c61db26';
const GUEST_ID = 'ae489d9b-96ce-4942-bcb1-c2e2a0c92e83';
const SEAT_ID = '23c7efa1-bcae-4d0c-ab73-956cba5e0227';
const INVITATION_ID = '6ffb6a85-9265-443a-a33f-3846e30fd91a';

/* ----------------------------------------------------------------------
 * Seed
 * -------------------------------------------------------------------- */
async function main(): Promise<void> {
  console.log('🌱 Seeding ticket domain…');

  /* ------------------------------------------------------------
   * Ticket
   * ---------------------------------------------------------- */
  const ticket = await prisma.ticket.upsert({
    where: { invitationId: INVITATION_ID },
    update: {},
    create: {
      eventId: EVENT_ID,
      invitationId: INVITATION_ID,
      guestProfileId: GUEST_ID,
      seatId: SEAT_ID,

      // deviceId: 'device_hash_demo_001',
      // devicePublicKey: 'device_public_key_demo_001',
      // deviceActivationAt: new Date(),
      // deviceActivationIP: '88.130.219.21',

      lastNonce: 10,
      nextNonce: 11,

      currentState: PresenceState.OUTSIDE,
      revoked: false,
    },
  });

  console.log('✅ Ticket created:', ticket.id);

  /* ------------------------------------------------------------
   * ShareGuard (initially clean)
   * ---------------------------------------------------------- */
  const shareGuard = await prisma.shareGuard.upsert({
    where: { ticketId: ticket.id },
    update: {},
    create: {
      ticketId: ticket.id,
      failCount: 0,
      reason: null,
    },
  });

  console.log('✅ ShareGuard created:', shareGuard.id);

  /* ------------------------------------------------------------
   * ScanLogs (realistic history)
   * ---------------------------------------------------------- */
  await prisma.scanLog.createMany({
    data: [
      {
        ticketId: ticket.id,
        eventId: EVENT_ID,
        direction: PresenceState.INSIDE,
        verdict: ScanVerdict.OK,
        nonce: 10,
        deviceId: 'device_hash_demo_001',
        gate: 'Main Gate',
        actorId: 'ea8b3a5b-47d0-4bf9-9bfa-bbc75adef663',
      },
      {
        ticketId: ticket.id,
        eventId: EVENT_ID,
        direction: PresenceState.OUTSIDE,
        verdict: ScanVerdict.OK,
        nonce: 11,
        deviceId: 'device_hash_demo_001',
        gate: 'Main Gate',
        actorId: 'ea8b3a5b-47d0-4bf9-9bfa-bbc75adef663',
      },
    ],
  });

  console.log('✅ ScanLogs created');

  console.log('--------------------------------------------------');
  console.log('🎫 TICKET SEED – CREATED IDS');
  console.log('--------------------------------------------------');

  console.log('Event ID:         ', EVENT_ID);
  console.log('Invitation ID:    ', INVITATION_ID);
  console.log('Guest Profile ID: ', GUEST_ID);
  console.log('Seat ID:          ', SEAT_ID);

  console.log('--------------------------------------------------');
  console.log('Ticket ID:        ', ticket.id);
  console.log('ShareGuard ID:    ', shareGuard.id);
  console.log('--------------------------------------------------');
}

/* ----------------------------------------------------------------------
 * Bootstrap
 * -------------------------------------------------------------------- */
main()
  .catch((e) => {
    console.error('❌ Seed failed', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
