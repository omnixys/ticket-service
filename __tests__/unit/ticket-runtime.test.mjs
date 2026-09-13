import { SeatHandler } from '../../dist/handlers/seat.handler.js';
import {
  PresenceState,
  ScanVerdict,
} from '../../dist/prisma/generated/client.js';
import {
  TicketAccessDeniedException,
  TicketNotFoundException,
  TicketTokenInvalidException,
  TicketVerificationTokenException,
} from '../../dist/ticket/errors/ticket-domain.error.js';
import { TicketWriteService } from '../../dist/ticket/service/ticket-write.service.js';
import { TicketEventRoleResolver } from '../../dist/ticket/service/ticket-event-role-resolver.service.js';
import { TokenService } from '../../dist/ticket/service/token.service.js';
import { VerifyService } from '../../dist/ticket/service/verify.service.js';
import { GateDirection } from '../../dist/ticket/models/enums/gate-direction.enum.js';
import { ContextAccessor } from '@omnixys/context-ts';
import { EventPermissionKey, EventRoleType } from '@omnixys/contracts-ts';
import { KafkaTopics } from '@omnixys/kafka-ts';
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

  const accepted = await service.verifyToken(
    token,
    signature,
    'device-1',
    GateDirection.ENTRY,
  );
  assert.equal(accepted.verdict, ScanVerdict.OK);
  assert.equal(accepted.ticket.currentState, PresenceState.INSIDE);
  assert.equal(accepted.ticket.lastNonce, 1);
  assert.equal(accepted.ticket.nextNonce, 2);
  assert.ok(accepted.ticket.checkedInAt instanceof Date);

  const replay = await service.verifyToken(
    token,
    signature,
    'device-1',
    GateDirection.ENTRY,
  );
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

/* ------------------------------------------------------------------ */
/* Gate direction policy                                               */
/* ------------------------------------------------------------------ */

function createVerifyService({ stored, endsAt = null }) {
  const tokenService = createTokenService();
  const { publicKey, privateKey } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  });
  let current = {
    ...ticket({
      deviceId: 'device-gate',
      devicePublicKey: publicKey
        .export({ type: 'spki', format: 'der' })
        .toString('base64'),
    }),
    ...stored,
  };

  const decisions = [];
  let replayAcquired = false;
  const applied = [];

  const service = new VerifyService(
    {
      ticket: {
        async findUnique() {
          return current;
        },
        async updateMany({ data }) {
          applied.push(data);
          current = { ...current, ...data, updatedAt: new Date() };
          return { count: 1 };
        },
      },
      eventSettingsProjection: {
        async findUnique() {
          return endsAt ? { endsAt } : null;
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

  return { service, tokenService, privateKey, get current() { return current; }, applied, decisions, get replayAcquired() { return replayAcquired; } };
}

async function signedToken(harness, dn) {
  const { service, tokenService, privateKey } = harness;
  const token = await tokenService.generate({
    tid: harness.current.id,
    eid: harness.current.eventId,
    gid: harness.current.guestProfileId,
    sid: harness.current.seatId,
    dn,
    ts: Date.now(),
  });
  const signer = createSign('SHA256');
  signer.update(`${token}.device-gate`);
  signer.end();
  return { token, signature: signer.sign(privateKey).toString('base64') };
}

test('ENTRY scan of an outside guest grants access and sets checkedInAt', async () => {
  const harness = createVerifyService({ stored: { currentState: PresenceState.OUTSIDE, nextNonce: 5, lastNonce: 4 } });
  const qr = await signedToken(harness, 5);

  const result = await harness.service.verifyToken(qr.token, qr.signature, 'device-gate', GateDirection.ENTRY);

  assert.equal(result.verdict, ScanVerdict.OK);
  assert.equal(result.message, 'Access granted');
  assert.equal(result.ticket.currentState, PresenceState.INSIDE);
  assert.ok(result.ticket.checkedInAt instanceof Date);
  assert.equal(harness.applied[0].lastNonce, 5);
  assert.equal(harness.applied[0].nextNonce, 6);
});

test('REFLECT: ENTRY scan of an inside guest rejects ALREADY_INSIDE without consuming the nonce', async () => {
  const harness = createVerifyService({ stored: { currentState: PresenceState.INSIDE, nextNonce: 5, lastNonce: 4, checkedInAt: new Date('2026-09-13T12:00:00.000Z') } });
  const qr = await signedToken(harness, 5);

  const result = await harness.service.verifyToken(qr.token, qr.signature, 'device-gate', GateDirection.ENTRY);

  assert.equal(result.verdict, ScanVerdict.ALREADY_INSIDE);
  assert.equal(result.message, 'Already inside');
  assert.equal(harness.applied.length, 0);
  assert.equal(harness.replayAcquired, false);
  assert.equal(harness.decisions.length, 0);

  const followingExit = await harness.service.verifyToken(qr.token, qr.signature, 'device-gate', GateDirection.EXIT);
  assert.equal(followingExit.verdict, ScanVerdict.OK);
  assert.equal(followingExit.ticket.currentState, PresenceState.OUTSIDE);
});

test('EXIT scan of an inside guest grants exit and keeps checkedInAt', async () => {
  const checkedInAt = new Date('2026-09-13T12:00:00.000Z');
  const harness = createVerifyService({ stored: { currentState: PresenceState.INSIDE, nextNonce: 5, lastNonce: 4, checkedInAt } });
  const qr = await signedToken(harness, 5);

  const result = await harness.service.verifyToken(qr.token, qr.signature, 'device-gate', GateDirection.EXIT);

  assert.equal(result.verdict, ScanVerdict.OK);
  assert.equal(result.ticket.currentState, PresenceState.OUTSIDE);
  assert.equal(result.ticket.checkedInAt, checkedInAt);
});

test('REFLECT: EXIT scan of an outside guest rejects NOT_INSIDE without consuming the nonce', async () => {
  const harness = createVerifyService({ stored: { currentState: PresenceState.OUTSIDE, nextNonce: 5, lastNonce: 4, checkedInAt: new Date('2026-09-13T12:00:00.000Z') } });
  const qr = await signedToken(harness, 5);

  const result = await harness.service.verifyToken(qr.token, qr.signature, 'device-gate', GateDirection.EXIT);

  assert.equal(result.verdict, ScanVerdict.NOT_INSIDE);
  assert.equal(result.message, 'Not inside');
  assert.equal(harness.applied.length, 0);
  assert.equal(harness.replayAcquired, false);
});

test('EXPIRED_EVENT blocks ENTRY when endsAt has passed without consuming the nonce', async () => {
  const harness = createVerifyService({
    stored: { currentState: PresenceState.OUTSIDE, nextNonce: 5, lastNonce: 4 },
    endsAt: new Date(Date.now() - 60_000),
  });
  const qr = await signedToken(harness, 5);

  const result = await harness.service.verifyToken(qr.token, qr.signature, 'device-gate', GateDirection.ENTRY);

  assert.equal(result.verdict, ScanVerdict.EXPIRED_EVENT);
  assert.equal(result.message, 'Event Expired');
  assert.equal(harness.applied.length, 0);
});

test('ENTRY is allowed before the event ends and when endsAt is unknown (fail-open)', async () => {
  const future = new Date(Date.now() + 3_600_000);
  const harnessFuture = createVerifyService({
    stored: { currentState: PresenceState.OUTSIDE, nextNonce: 5, lastNonce: 4 },
    endsAt: future,
  });
  const qrFuture = await signedToken(harnessFuture, 5);
  assert.equal(
    (await harnessFuture.service.verifyToken(qrFuture.token, qrFuture.signature, 'device-gate', GateDirection.ENTRY)).verdict,
    ScanVerdict.OK,
  );

  const harnessUnknown = createVerifyService({
    stored: { currentState: PresenceState.OUTSIDE, nextNonce: 5, lastNonce: 4 },
    endsAt: null,
  });
  const qrUnknown = await signedToken(harnessUnknown, 5);
  assert.equal(
    (await harnessUnknown.service.verifyToken(qrUnknown.token, qrUnknown.signature, 'device-gate', GateDirection.ENTRY)).verdict,
    ScanVerdict.OK,
  );
});

test('EXPIRED_EVENT only applies to ENTRY: EXIT stays allowed after the event ends', async () => {
  const checkedInAt = new Date(Date.now() - 3_600_000);
  const harness = createVerifyService({
    stored: { currentState: PresenceState.INSIDE, nextNonce: 5, lastNonce: 4, checkedInAt },
    endsAt: new Date(Date.now() - 60_000),
  });
  const qr = await signedToken(harness, 5);

  const result = await harness.service.verifyToken(qr.token, qr.signature, 'device-gate', GateDirection.EXIT);

  assert.equal(result.verdict, ScanVerdict.OK);
  assert.equal(result.ticket.currentState, PresenceState.OUTSIDE);
});

/* ------------------------------------------------------------------ */
/* Manual presence override (updateTicketPresence)                     */
/* ------------------------------------------------------------------ */

function createPresenceHarness({ stored, permissions }) {
  const logs = [];
  const facts = [];
  const transactionClient = {
    ticket: {
      async update({ data }) {
        stored = { ...stored, ...data };
        return stored;
      },
    },
    scanLog: {
      async create({ data }) {
        logs.push(data);
        return { id: 'log-manual', createdAt: new Date(), ...data };
      },
    },
  };
  const service = new TicketWriteService(
    {
      ticket: {
        async findUnique() {
          return stored;
        },
      },
      async $transaction(work) {
        return work(transactionClient);
      },
    },
    logger,
    {},
    { async send() {} },
    { getPermissionsForUser: async () => permissions },
    {
      async enqueue(_tx, topic, fact) {
        facts.push({ topic, eventName: fact.eventName, properties: fact.properties });
      },
    },
  );
  return {
    service,
    logs,
    facts,
    get stored() {
      return stored;
    },
  };
}

const SCAN_PERMISSIONS = [EventPermissionKey.ScanTickets];

test('manual INSIDE marks the ticket as present and audits a MANUAL OK scan', async () => {
  const harness = createPresenceHarness({
    stored: ticket({}),
    permissions: SCAN_PERMISSIONS,
  });

  const result = await harness.service.updatePresence({
    ticketId: harness.stored.id,
    state: PresenceState.INSIDE,
    actorId: 'security-1',
  });

  assert.equal(result.currentState, PresenceState.INSIDE);
  assert.ok(result.checkedInAt instanceof Date);
  assert.equal(harness.logs.length, 1);
  assert.equal(harness.logs[0].gate, 'MANUAL');
  assert.equal(harness.logs[0].direction, PresenceState.INSIDE);
  assert.equal(harness.logs[0].verdict, ScanVerdict.OK);
  assert.equal(harness.logs[0].actorId, 'security-1');
  assert.equal(harness.facts[0].topic, 'ticket.guest.checked-in.v1');
  assert.equal(harness.facts[0].eventName, 'GuestCheckedIn');
});

test('manual OUT keeps checkedInAt and emits the checked-out fact', async () => {
  const checkedInAt = new Date('2026-09-13T12:00:00.000Z');
  const harness = createPresenceHarness({
    stored: ticket({ currentState: PresenceState.INSIDE, checkedInAt }),
    permissions: SCAN_PERMISSIONS,
  });

  const result = await harness.service.updatePresence({
    ticketId: harness.stored.id,
    state: PresenceState.OUTSIDE,
    actorId: 'security-1',
  });

  assert.equal(result.currentState, PresenceState.OUTSIDE);
  assert.equal(result.checkedInAt, checkedInAt);
  assert.equal(harness.logs.length, 1);
  assert.equal(harness.logs[0].direction, PresenceState.OUTSIDE);
  assert.equal(harness.facts[0].topic, 'ticket.guest.checked-out.v1');
  assert.equal(harness.facts[0].eventName, 'GuestCheckedOut');
});

test('an already matching state is a no-op without audit trail or fact', async () => {
  const harness = createPresenceHarness({
    stored: ticket({ currentState: PresenceState.INSIDE, checkedInAt: new Date() }),
    permissions: SCAN_PERMISSIONS,
  });

  const result = await harness.service.updatePresence({
    ticketId: harness.stored.id,
    state: PresenceState.INSIDE,
    actorId: 'security-1',
  });

  assert.equal(result.currentState, PresenceState.INSIDE);
  assert.equal(harness.logs.length, 0);
  assert.equal(harness.facts.length, 0);
});

test('manual presence override requires the ScanTickets permission', async () => {
  const harness = createPresenceHarness({
    stored: ticket({}),
    permissions: [EventPermissionKey.ViewTickets],
  });

  await assert.rejects(
    harness.service.updatePresence({
      ticketId: harness.stored.id,
      state: PresenceState.INSIDE,
      actorId: 'security-1',
    }),
    (error) => {
      assert.equal(error.name, 'EventAccessDeniedException');
      return true;
    },
  );
  assert.equal(harness.logs.length, 0);
});

test('revoked tickets cannot be overridden manually', async () => {
  const harness = createPresenceHarness({
    stored: ticket({ revoked: true }),
    permissions: SCAN_PERMISSIONS,
  });

  await assert.rejects(
    harness.service.updatePresence({
      ticketId: harness.stored.id,
      state: PresenceState.INSIDE,
      actorId: 'security-1',
    }),
    (error) => {
      assert.ok(error instanceof TicketAccessDeniedException);
      return true;
    },
  );
  assert.equal(harness.logs.length, 0);
});

test('manual presence override for an unknown ticket fails fast', async () => {
  const harness = createPresenceHarness({
    stored: null,
    permissions: SCAN_PERMISSIONS,
  });

  await assert.rejects(
    harness.service.updatePresence({
      ticketId: ticket().id,
      state: PresenceState.INSIDE,
      actorId: 'security-1',
    }),
    (error) => {
      assert.equal(error instanceof TicketNotFoundException, true);
      return true;
    },
  );
});
