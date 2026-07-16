import { PrismaClient } from '../src/prisma/generated/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const totalTickets = await prisma.ticket.count();
  const scanLogs = await prisma.scanLog.count();
  const shareGuards = await prisma.shareGuard.count();

  // Check for duplicate seat assignments
  const ticketsWithSeat = await prisma.ticket.findMany({
    where: { seatId: { not: undefined } },
    select: { seatId: true, id: true },
  });

  const seatCounts = new Map<string, number>();
  let duplicateSeats = 0;
  for (const t of ticketsWithSeat) {
    const count = (seatCounts.get(t.seatId!) ?? 0) + 1;
    seatCounts.set(t.seatId!, count);
    if (count > 1) duplicateSeats++;
  }

  const result = {
    service: 'ticket',
    checks: [
      { name: 'Tickets', ok: totalTickets > 0, count: totalTickets },
      { name: 'Scan Logs', ok: scanLogs > 0, count: scanLogs },
      { name: 'Share Guards', ok: shareGuards > 0, count: shareGuards },
      { name: 'Occupied Seats', ok: ticketsWithSeat.length > 0, count: ticketsWithSeat.length },
      {
        name: 'No duplicate seat assignments',
        ok: duplicateSeats === 0,
        count: duplicateSeats,
        detail: duplicateSeats > 0 ? `${duplicateSeats} seats multiply assigned` : undefined,
      },
    ],
  };

  console.log('VALIDATE_JSON:' + JSON.stringify(result));
}

main()
  .catch((e) => {
    console.error('❌ Validate failed', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
