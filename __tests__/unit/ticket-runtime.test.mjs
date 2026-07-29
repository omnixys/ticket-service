import { SeatHandler } from '../../dist/handlers/seat.handler.js';
import {
  PresenceState,
  ScanVerdict,
} from '../../dist/prisma/generated/client.js';
import {
  TicketAccessDeniedException,
  TicketTokenInvalidException,
  TicketVerificationTokenException,
} from '../../dist/ticket/errors/ticket-domain.error.js';
import { TicketWriteService } from '../../dist/ticket/service/ticket-write.service.js';
import { TicketEventRoleResolver } from '../../dist/ticket/service/ticket-event-role-resolver.service.js';
import { TokenService } from '../../dist/ticket/service/token.service.js';
import { VerifyService } from '../../dist/ticket/service/verify.service.js';
import { ContextAccessor } from '@omnixys/context';
import { EventPermissionKey, EventRoleType } from '@omnixys/contracts';
import { KafkaTopics } from '@omnixys/kafka';
import assert from 'node:assert/strict';
import { createSign, generateKeyPairSync, randomBytes } from 'node:crypto';
import test from 'node:test';

const logger = {
  log() {
    return {
      debug() {},
      info() {},
      warn() {},
      error() {},
    };
  },
};

function ticket(overrides = {}) {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    eventId: '00000000-0000-4000-8000-000000000002',
    invitationId: '00000000-0000-4000-8000-000000000003',
    seatId: '00000000-0000-4000-8000-000000000004',
    guestProfileId: '00000000-0000-4000-8000-000000000005',
    devicePublicKey: null,
    deviceActivationAt: null,
    deviceActivationIP: null,
    deviceId: null,
    lastNonce: null,
    nextNonce: 1,
    checkedInAt: null,
    currentState: PresenceState.OUTSIDE,
    revoked: false,
    revokedAt: null,
    revokedBy: null,
    revokedReason: null,
    createdAt: new Date('2026-06-22T10:00:00.000Z'),
    updatedAt: null,
    ...overrides,
  };
}

function createTokenService() {
  process.env.QR_JWE_KEY = randomBytes(32).toString('base64');
  process.env.QR_JWS_KEYS = JSON.stringify({
    v1: randomBytes(32).toString('base64'),
  });
  process.env.QR_ACTIVE_KID = 'v1';
  return new TokenService();
}

test('QR tokens round-trip and invalid values produce structured errors', async () => {
  const service = createTokenService();
  const value = ticket();
  const encoded = await service.generate({
    tid: value.id,
    eid: value.eventId,
    gid: value.guestProfileId,
    sid: value.seatId,
    dn: 1,
    ts: Date.now(),
  });

  const decoded = await service.verify(encoded);
  assert.equal(decoded.tid, value.id);
  assert.equal(decoded.dn, 1);

  await ContextAccessor.run({ requestId: 'request-token' }, async () => {
    await assert.rejects(service.verify('invalid'), (error) => {
      assert.ok(error instanceof TicketTokenInvalidException);
      assert.equal(error.requestId, 'request-token');
      return true;
    });
  });
});

test('P-256 device signatures pass, rotate nonce, and detect replay', async () => {
  const tokenService = createTokenService();
  const { publicKey, privateKey } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  });
  let stored = ticket({
    deviceId: 'device-1',
    devicePublicKey: publicKey
      .export({ type: 'spki', format: 'der' })
      .toString('base64'),
  });
  const token = await tokenService.generate({
    tid: stored.id,
    eid: stored.eventId,
    gid: stored.guestProfileId,
    sid: stored.seatId,
    dn: 1,
    ts: Date.now(),
  });
  const signer = createSign('SHA256');
  signer.update(`${token}.device-1`);
  signer.end();
  const signature = signer.sign(privateKey).toString('base64');
  const decisions = [];
  let replayAcquired = false;
  const service = new VerifyService(
    {
      ticket: {
        async findUnique() {
          return stored;
        },
        async updateMany({ data }) {
          stored = { ...stored, ...data, updatedAt: new Date() };
          return { count: 1 };
        },
      },
    },
    tokenService,
    {
      async isBlocked() {
        return false;
      },
      calculateRisk(input) {
        return input;
      },
      async applyDecision(_ticketId, decision) {
        decisions.push(decision);
      },
      async resetShareGuard() {},
    },
    {
      async rawSetIfAbsent() {
        if (replayAcquired) return false;
        replayAcquired = true;
        return true;
      },
    },
  );

  const accepted = await service.verifyToken(token, signature, 'device-1');
  assert.equal(accepted.verdict, ScanVerdict.OK);
  assert.equal(accepted.ticket.currentState, PresenceState.INSIDE);
  assert.equal(accepted.ticket.lastNonce, 1);
  assert.equal(accepted.ticket.nextNonce, 2);
  assert.ok(accepted.ticket.checkedInAt instanceof Date);

  const replay = await service.verifyToken(token, signature, 'device-1');
  assert.equal(replay.verdict, ScanVerdict.REPLAY);
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0].replay, true);
});

test('ticket creation is idempotent and republishes its stable milestone', async () => {
  const existing = ticket();
  const sent = [];
  const service = new TicketWriteService(
    {
      ticket: {
        async findUnique() {
          return existing;
        },
      },
    },
    logger,
    {},
    {
      async send(event) {
        sent.push(event);
      },
    },
    { getPermissionsForUser: async () => [] },
  );

  const result = await ContextAccessor.run(
    {
      requestId: 'request-create',
      actorId: 'actor-1',
      tenantId: 'tenant-1',
    },
    () =>
      service.createTicket({
        eventId: existing.eventId,
        invitationId: existing.invitationId,
        userId: existing.guestProfileId,
        seatId: existing.seatId,
        actorId: 'actor-1',
      }),
  );

  assert.equal(result.id, existing.id);
  assert.equal(sent[0].topic, KafkaTopics.event.milestoneRecorded);
  assert.equal(sent[0].payload.milestoneId, `${existing.id}:generated`);
  assert.equal(sent[0].meta.actorId, 'actor-1');
  assert.equal(sent[0].meta.tenantId, 'tenant-1');
});

test('new ticket and generated fact use the same transaction client', async () => {
  const created = ticket();
  const transactionClient = {
    ticket: {
      async create() {
        return created;
      },
    },
  };
  let factTransaction;
  const service = new TicketWriteService(
    {
      ticket: {
        async findUnique() {
          return null;
        },
      },
      async $transaction(work) {
        return work(transactionClient);
      },
    },
    logger,
    {},
    { async send() {} },
    { getPermissionsForUser: async () => [] },
    {
      async enqueue(tx, topic, fact) {
        factTransaction = tx;
        assert.equal(topic, 'ticket.generated.v1');
        assert.equal(fact.eventName, 'TicketGenerated');
      },
    },
  );

  await service.createTicket({
    eventId: created.eventId,
    invitationId: created.invitationId,
    userId: created.guestProfileId,
    seatId: created.seatId,
    actorId: 'actor-1',
  });

  assert.equal(factTransaction, transactionClient);
});

test('device binding rejects a non-owner before changing the ticket', async () => {
  const existing = ticket();
  const service = new TicketWriteService(
    {
      async $transaction(work) {
        return work({
          ticket: {
            async findUnique() {
              return existing;
            },
          },
        });
      },
    },
    logger,
    {},
    {},
    { getPermissionsForUser: async () => [] },
  );

  await ContextAccessor.run({ requestId: 'request-owner' }, async () => {
    await assert.rejects(
      service.activateDevice(
        {
          ticketId: existing.id,
          deviceId: 'device-1',
          publicKey: 'not-reached',
        },
        '00000000-0000-4000-8000-000000000099',
      ),
      (error) => {
        assert.ok(error instanceof TicketAccessDeniedException);
        assert.equal(error.requestId, 'request-owner');
        assert.equal(error.code, 'TICKET_ACCESS_DENIED');
        return true;
      },
    );
  });
});

test('ticket permission resolver prefers access projection over legacy roles', async () => {
  const resolver = new TicketEventRoleResolver({
    eventAccessProjection: {
      async findUnique() {
        return {
          permissions: [EventPermissionKey.ViewTickets, 'unknown.permission'],
        };
      },
    },
    eventRoleProjection: {
      async findUnique() {
        throw new Error('legacy fallback must not be used when access projection exists');
      },
    },
  });

  assert.deepEqual(await resolver.getPermissionsForUser('user-1', 'event-1'), [
    EventPermissionKey.ViewTickets,
  ]);
});

test('ticket permission resolver treats empty access projection as immediate access removal', async () => {
  const resolver = new TicketEventRoleResolver({
    eventAccessProjection: {
      async findUnique() {
        return { permissions: [] };
      },
    },
    eventRoleProjection: {
      async findUnique() {
        return { role: EventRoleType.ADMIN };
      },
    },
  });

  assert.deepEqual(await resolver.getPermissionsForUser('user-1', 'event-1'), []);
});

test('ticket permission resolver keeps legacy SUPPORT fallback compatible', async () => {
  const resolver = new TicketEventRoleResolver({
    eventAccessProjection: {
      async findUnique() {
        return null;
      },
    },
    eventRoleProjection: {
      async findUnique() {
        return { role: EventRoleType.SUPPORT };
      },
    },
  });

  const permissions = await resolver.getPermissionsForUser('user-1', 'event-1');
  assert.ok(permissions.includes(EventPermissionKey.ViewSupport));
  assert.equal(permissions.includes(EventPermissionKey.ViewTickets), false);
});

test('ticket creation handler rejects expired guest verification state', async () => {
  const handler = new SeatHandler(
    logger,
    {},
    {
      async get() {
        return null;
      },
    },
    {},
  );

  await ContextAccessor.run({ requestId: 'request-handler' }, async () => {
    await assert.rejects(
      handler.handleCreateTicket({
        token: 'expired',
        invitationId: '00000000-0000-4000-8000-000000000003',
        userId: '00000000-0000-4000-8000-000000000005',
      }),
      (error) => {
        assert.ok(error instanceof TicketVerificationTokenException);
        assert.equal(error.requestId, 'request-handler');
        return true;
      },
    );
  });
});
