/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';

import {
  createResolverTestApp,
  graphqlRequest,
  ids,
  scanResult,
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
  deviceActivationIP
  nextNonce
  currentState
  revoked
  revokedReason
`;

describe('TicketMutationResolver E2E', () => {
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

  it('resolves activateDevice and enriches input with ClientInfo ip', async () => {
    mocks.ticketWrite.activateDevice.mockResolvedValue(ticketPayload);

    const res = await graphqlRequest<{
      activateDevice: { id: string; deviceId: string };
    }>(
      app,
      `
        mutation ActivateDevice($input: ActivateDeviceInput!) {
          activateDevice(input: $input) { ${TICKET_FIELDS} }
        }
      `,
      {
        input: {
          ticketId: ids.ticketId,
          deviceId: 'device-1',
          publicKey: 'public-key',
        },
      },
    );

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data?.activateDevice.id).toBe(ids.ticketId);
    expect(res.body.data?.activateDevice.deviceId).toBe('device-1');
    expect(mocks.ticketWrite.activateDevice).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: ids.ticketId,
        deviceId: 'device-1',
        publicKey: 'public-key',
        ip: '203.0.113.9',
      }),
      ids.actorId,
    );
  });

  it('resolves generateToken', async () => {
    mocks.ticketWrite.generateToken.mockResolvedValue('qr-token');

    const res = await graphqlRequest<{ generateToken: string }>(
      app,
      `
        mutation GenerateToken($ticketId: ID!) {
          generateToken(ticketId: $ticketId)
        }
      `,
      { ticketId: ids.ticketId },
    );

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data?.generateToken).toBe('qr-token');
    expect(mocks.ticketWrite.generateToken).toHaveBeenCalledWith(
      ids.ticketId,
      ids.actorId,
    );
  });

  it('resolves scanToken and maps the service result', async () => {
    mocks.scan.scan.mockResolvedValue(scanResult);

    const res = await graphqlRequest<{
      scanToken: {
        verdict: string;
        message: string;
        ticket: { id: string };
        log: { ticketId: string; verdict: string };
      };
    }>(
      app,
      `
        mutation ScanToken($input: ScanInput!) {
          scanToken(input: $input) {
            verdict
            message
            ticket { ${TICKET_FIELDS} }
            log {
              id
              ticketId
              eventId
              actorId
              direction
              gate
              verdict
              nonce
              deviceId
            }
          }
        }
      `,
      {
        input: {
          token: 'qr-token',
          signature: 'signature',
          deviceId: 'device-1',
          gate: 'A1',
        },
      },
    );

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data?.scanToken.verdict).toBe('OK');
    expect(res.body.data?.scanToken.message).toBe('OK');
    expect(res.body.data?.scanToken.ticket.id).toBe(ids.ticketId);
    expect(res.body.data?.scanToken.log.ticketId).toBe(ids.ticketId);
    expect(mocks.scan.scan).toHaveBeenCalledWith({
      token: 'qr-token',
      signature: 'signature',
      deviceId: 'device-1',
      gate: 'A1',
      actorId: ids.actorId,
    });
  });

  it('resolves deleteTicket', async () => {
    mocks.ticketWrite.delete.mockResolvedValue(undefined);

    const res = await graphqlRequest<{ deleteTicket: boolean }>(
      app,
      `
        mutation DeleteTicket($ticketId: ID!) {
          deleteTicket(ticketId: $ticketId)
        }
      `,
      { ticketId: ids.ticketId },
    );

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data?.deleteTicket).toBe(true);
    expect(mocks.ticketWrite.delete).toHaveBeenCalledWith(ids.ticketId);
  });

  it('resolves revokeTicket with CurrentUser actor id', async () => {
    mocks.ticketWrite.revoke.mockResolvedValue({
      ...ticketPayload,
      revoked: true,
      revokedReason: 'manual test revoke',
    });

    const res = await graphqlRequest<{
      revokeTicket: { id: string; revoked: boolean; revokedReason: string };
    }>(
      app,
      `
        mutation RevokeTicket($input: RevokeTicketInput!) {
          revokeTicket(input: $input) { ${TICKET_FIELDS} }
        }
      `,
      {
        input: {
          ticketId: ids.ticketId,
          reason: 'manual test revoke',
        },
      },
    );

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data?.revokeTicket.id).toBe(ids.ticketId);
    expect(res.body.data?.revokeTicket.revoked).toBe(true);
    expect(res.body.data?.revokeTicket.revokedReason).toBe(
      'manual test revoke',
    );
    expect(mocks.ticketWrite.revoke).toHaveBeenCalledWith({
      ticketId: ids.ticketId,
      reason: 'manual test revoke',
      actorId: ids.actorId,
    });
  });
});
