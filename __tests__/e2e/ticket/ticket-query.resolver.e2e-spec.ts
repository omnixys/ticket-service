/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';

import {
  createResolverTestApp,
  graphqlRequest,
  ids,
  scanLogPayload,
  ticketPayload,
  type ResolverMocks,
} from './ticket-resolver.e2e-fixtures.js';

const TICKET_FIELDS = `
  id
  eventId
  invitationId
  seatId
  guestProfileId
  deviceId
  nextNonce
  currentState
  revoked
`;

const SCAN_LOG_FIELDS = `
  id
  ticketId
  eventId
  actorId
  direction
  gate
  verdict
  nonce
  deviceId
`;

describe('TicketQueryResolver E2E', () => {
  let app: INestApplication;
  let mocks: ResolverMocks;

  beforeAll(async () => {
    const setup = await createResolverTestApp();
    app = setup.app;
    mocks = setup.mocks;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('resolves ticketById', async () => {
    mocks.ticketRead.findById.mockResolvedValue(ticketPayload);
    mocks.ticketRead.findByIdForActor.mockResolvedValue(ticketPayload);

    const res = await graphqlRequest<{ ticketById: { id: string } }>(
      app,
      `
        query TicketById($id: ID!) {
          ticketById(id: $id) { ${TICKET_FIELDS} }
        }
      `,
      { id: ids.ticketId },
    );

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data?.ticketById.id).toBe(ids.ticketId);
    expect(mocks.ticketRead.findById).toHaveBeenCalledWith(ids.ticketId);
    expect(mocks.ticketRead.findByIdForActor).toHaveBeenCalledWith(
      ids.ticketId,
      ids.actorId,
      'ADMIN',
    );
  });

  it('resolves getAllTickets', async () => {
    mocks.ticketRead.findMany.mockResolvedValue([ticketPayload]);

    const res = await graphqlRequest<{ getAllTickets: Array<{ id: string }> }>(
      app,
      `
        query GetAllTickets {
          getAllTickets { ${TICKET_FIELDS} }
        }
      `,
    );

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data?.getAllTickets).toHaveLength(1);
    expect(res.body.data?.getAllTickets[0]?.id).toBe(ids.ticketId);
    expect(mocks.ticketRead.findMany).toHaveBeenCalledTimes(1);
  });

  it('resolves ticketsByEvent', async () => {
    mocks.ticketRead.findByEvent.mockResolvedValue([ticketPayload]);

    const res = await graphqlRequest<{
      ticketsByEvent: Array<{ eventId: string }>;
    }>(
      app,
      `
        query TicketsByEvent($eventId: ID!) {
          ticketsByEvent(eventId: $eventId) { ${TICKET_FIELDS} }
        }
      `,
      { eventId: ids.eventId },
    );

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data?.ticketsByEvent[0]?.eventId).toBe(ids.eventId);
    expect(mocks.ticketRead.findByEvent).toHaveBeenCalledWith(ids.eventId);
  });

  it('resolves ticketsByGuest', async () => {
    mocks.ticketRead.findByGuest.mockResolvedValue([ticketPayload]);

    const res = await graphqlRequest<{
      ticketsByGuest: Array<{ guestProfileId: string }>;
    }>(
      app,
      `
        query TicketsByGuest($guestProfileId: ID!) {
          ticketsByGuest(guestProfileId: $guestProfileId) { ${TICKET_FIELDS} }
        }
      `,
      { guestProfileId: ids.guestProfileId },
    );

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data?.ticketsByGuest[0]?.guestProfileId).toBe(
      ids.guestProfileId,
    );
    expect(mocks.ticketRead.findByGuest).toHaveBeenCalledWith(
      ids.guestProfileId,
    );
  });

  it('resolves ticketByInvitation', async () => {
    mocks.ticketRead.findByInvitation.mockResolvedValue(ticketPayload);
    mocks.ticketRead.findByInvitationForActor.mockResolvedValue(ticketPayload);

    const res = await graphqlRequest<{
      ticketByInvitation: { invitationId: string };
    }>(
      app,
      `
        query TicketByInvitation($invitationId: ID!) {
          ticketByInvitation(invitationId: $invitationId) { ${TICKET_FIELDS} }
        }
      `,
      { invitationId: ids.invitationId },
    );

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data?.ticketByInvitation.invitationId).toBe(
      ids.invitationId,
    );
    expect(mocks.ticketRead.findByInvitation).toHaveBeenCalledWith(
      ids.invitationId,
    );
    expect(mocks.ticketRead.findByInvitationForActor).toHaveBeenCalledWith(
      ids.invitationId,
      ids.actorId,
      'ADMIN',
    );
  });

  it('resolves scanLogsByTicket', async () => {
    mocks.ticketRead.findById.mockResolvedValue(ticketPayload);
    mocks.ticketRead.scanLogsForActor.mockResolvedValue([scanLogPayload]);

    const res = await graphqlRequest<{
      scanLogsByTicket: Array<{ ticketId: string; verdict: string }>;
    }>(
      app,
      `
        query ScanLogsByTicket($ticketId: ID!) {
          scanLogsByTicket(ticketId: $ticketId) { ${SCAN_LOG_FIELDS} }
        }
      `,
      { ticketId: ids.ticketId },
    );

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data?.scanLogsByTicket[0]?.ticketId).toBe(ids.ticketId);
    expect(res.body.data?.scanLogsByTicket[0]?.verdict).toBe('OK');
    expect(mocks.ticketRead.findById).toHaveBeenCalledWith(ids.ticketId);
    expect(mocks.ticketRead.scanLogsForActor).toHaveBeenCalledWith(
      ids.ticketId,
      ids.actorId,
      'ADMIN',
    );
  });

  it('resolves getMyTickets with CurrentUser from the GraphQL request', async () => {
    mocks.ticketRead.findByGuest.mockResolvedValue([ticketPayload]);

    const res = await graphqlRequest<{ getMyTickets: Array<{ id: string }> }>(
      app,
      `
        query GetMyTickets {
          getMyTickets { ${TICKET_FIELDS} }
        }
      `,
    );

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data?.getMyTickets[0]?.id).toBe(ids.ticketId);
    expect(mocks.ticketRead.findByGuest).toHaveBeenCalledWith(
      ids.guestProfileId,
    );
  });
});
