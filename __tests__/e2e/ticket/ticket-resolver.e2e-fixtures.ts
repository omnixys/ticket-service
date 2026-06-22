/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { ScanVerdict as PrismaScanVerdict } from '../../../src/prisma/generated/client.js';
import type { ScanLog, Ticket } from '../../../src/prisma/generated/client.js';
import type { ScanLogPayload } from '../../../src/ticket/models/payloads/scan-log-list.payload.js';
import type { TicketPayload } from '../../../src/ticket/models/payloads/ticket-payload.js';
import type { ScanPayloadDTO } from '../../../src/ticket/service/scan.service.js';
import type { ScanService } from '../../../src/ticket/service/scan.service.js';
import type { TicketReadService } from '../../../src/ticket/service/ticket-read.service.js';
import type { TicketWriteService } from '../../../src/ticket/service/ticket-write.service.js';
import { jest } from '@jest/globals';
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import {
  createParamDecorator,
  type INestApplication,
  type ExecutionContext,
} from '@nestjs/common';
import { GraphQLModule, GqlExecutionContext } from '@nestjs/graphql';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';

const AUTH_USER_ID = '00000000-0000-4000-8000-000000000111';

class MockCookieAuthGuard {}
class MockRoleGuard {}
class MockTicketReadService {}
class MockTicketWriteService {}
class MockScanService {}

const MockCurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const gqlContext = GqlExecutionContext.create(context);
    const requestContext = gqlContext.getContext<{ req: RequestWithUser }>();
    const user = requestContext.req.user;
    if (!user) {
      return null;
    }

    return {
      id: user.sub,
      username: user.preferred_username,
      email: user.email,
      firstName: user.given_name,
      lastName: user.family_name,
      role: 'USER',
      access_token: undefined,
      refresh_token: undefined,
      raw: user.raw,
    };
  },
);

jest.unstable_mockModule('@omnixys/security', () => ({
  CookieAuthGuard: MockCookieAuthGuard,
  CurrentUser: MockCurrentUser,
  CurrentUserData: Object,
  RoleGuard: MockRoleGuard,
  Roles: () => () => undefined,
}));

jest.unstable_mockModule('@omnixys/shared', () => ({
  ClientContext: Object,
  n2u: <T>(value: T | null): T | undefined => value ?? undefined,
}));

jest.unstable_mockModule(
  '../../../src/ticket/service/ticket-read.service.js',
  () => ({
    TicketReadService: MockTicketReadService,
  }),
);

jest.unstable_mockModule(
  '../../../src/ticket/service/ticket-write.service.js',
  () => ({
    TicketWriteService: MockTicketWriteService,
  }),
);

jest.unstable_mockModule('../../../src/ticket/service/scan.service.js', () => ({
  ScanService: MockScanService,
}));

interface RequestWithUser {
  headers: Record<string, string | string[] | undefined>;
  cookies: Record<string, string | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
  user?: {
    sub: string;
    preferred_username: string;
    email: string;
    given_name: string;
    family_name: string;
    raw: {
      sub: string;
      preferred_username: string;
      given_name: string;
      family_name: string;
      realm_access: { roles: string[] };
    };
  };
}

interface GraphQLResponse<TData> {
  body: {
    data?: TData;
    errors?: Array<{ message: string }>;
  };
}

interface FastifyInjectable {
  inject(options: {
    method: 'POST';
    url: string;
    headers: Record<string, string>;
    payload: string;
  }): Promise<{ payload: string }>;
}

export interface ResolverMocks {
  ticketRead: jest.Mocked<
    Pick<
      TicketReadService,
      | 'findByIdForActor'
      | 'findMany'
      | 'findByEvent'
      | 'findByGuest'
      | 'findByGuestForActor'
      | 'findByInvitationForActor'
      | 'scanLogsForActor'
    >
  >;
  ticketWrite: jest.Mocked<
    Pick<
      TicketWriteService,
      'activateDevice' | 'generateToken' | 'delete' | 'revoke'
    >
  >;
  scan: jest.Mocked<Pick<ScanService, 'scan'>>;
}

export interface ResolverTestApp {
  app: INestApplication;
  mocks: ResolverMocks;
}

export const ids = {
  ticketId: '10000000-0000-4000-8000-000000000001',
  eventId: '10000000-0000-4000-8000-000000000002',
  invitationId: '10000000-0000-4000-8000-000000000003',
  seatId: '10000000-0000-4000-8000-000000000004',
  guestProfileId: AUTH_USER_ID,
  actorId: AUTH_USER_ID,
  scanLogId: '10000000-0000-4000-8000-000000000005',
};

export const ticketPayload: TicketPayload = {
  id: ids.ticketId,
  eventId: ids.eventId,
  invitationId: ids.invitationId,
  seatId: ids.seatId,
  guestProfileId: ids.guestProfileId,
  deviceId: 'device-1',
  devicePublicKey: 'public-key',
  deviceActivationAt: new Date('2026-04-30T10:00:00.000Z'),
  deviceActivationIP: '203.0.113.9',
  lastNonce: 1,
  nextNonce: 2,
  currentState: 'OUTSIDE',
  checkedInAt: undefined,
  revoked: false,
  revokedAt: undefined,
  revokedBy: undefined,
  revokedReason: undefined,
  createdAt: new Date('2026-04-30T09:00:00.000Z'),
  updatedAt: new Date('2026-04-30T09:30:00.000Z'),
};

export const scanLogPayload: ScanLogPayload = {
  id: ids.scanLogId,
  ticketId: ids.ticketId,
  eventId: ids.eventId,
  actorId: ids.actorId,
  direction: 'OUTSIDE',
  gate: 'A1',
  verdict: PrismaScanVerdict.OK,
  nonce: 2,
  deviceId: 'device-1',
  createdAt: new Date('2026-04-30T10:05:00.000Z'),
};

export const prismaTicket: Ticket = {
  ...ticketPayload,
  deviceActivationAt: ticketPayload.deviceActivationAt ?? null,
  checkedInAt: ticketPayload.checkedInAt ?? null,
  revokedAt: ticketPayload.revokedAt ?? null,
  revokedBy: ticketPayload.revokedBy ?? null,
  revokedReason: ticketPayload.revokedReason ?? null,
};

export const prismaScanLog: ScanLog = {
  ...scanLogPayload,
  gate: scanLogPayload.gate ?? null,
  nonce: scanLogPayload.nonce ?? null,
  deviceId: scanLogPayload.deviceId ?? null,
};

export const scanResult: ScanPayloadDTO = {
  ticket: prismaTicket,
  log: prismaScanLog,
  verdict: PrismaScanVerdict.OK,
  message: 'OK',
};

export async function createResolverTestApp(): Promise<ResolverTestApp> {
  const { TicketQueryResolver } = await import(
    '../../../src/ticket/resolvers/ticket-query.resolver.js'
  );
  const { TicketMutationResolver } = await import(
    '../../../src/ticket/resolvers/ticket-mutation.resolver.js'
  );
  const { CookieAuthGuard, RoleGuard } = await import('@omnixys/security');

  const mocks: ResolverMocks = {
    ticketRead: {
      findByIdForActor: jest.fn(),
      findMany: jest.fn(),
      findByEvent: jest.fn(),
      findByGuest: jest.fn(),
      findByGuestForActor: jest.fn(),
      findByInvitationForActor: jest.fn(),
      scanLogsForActor: jest.fn(),
    },
    ticketWrite: {
      activateDevice: jest.fn(),
      generateToken: jest.fn(),
      delete: jest.fn(),
      revoke: jest.fn(),
    },
    scan: {
      scan: jest.fn(),
    },
  };

  const authGuard = {
    canActivate(context: ExecutionContext): boolean {
      const gqlContext = GqlExecutionContext.create(context);
      const requestContext = gqlContext.getContext<{ req: RequestWithUser }>();
      const req = requestContext.req;

      req.cookies ??= {};
      req.user = {
        sub: AUTH_USER_ID,
        preferred_username: 'ticket-tester',
        email: 'ticket-tester@omnixys.test',
        given_name: 'Ticket',
        family_name: 'Tester',
        raw: {
          sub: AUTH_USER_ID,
          preferred_username: 'ticket-tester',
          given_name: 'Ticket',
          family_name: 'Tester',
          realm_access: { roles: ['USER'] },
        },
      };

      return true;
    },
  };

  const moduleRef = await Test.createTestingModule({
    imports: [
      GraphQLModule.forRoot<ApolloDriverConfig>({
        driver: ApolloDriver,
        autoSchemaFile: true,
        sortSchema: true,
        context: ({ req }: { req: RequestWithUser }) => ({ req }),
      }),
    ],
    providers: [
      TicketQueryResolver,
      TicketMutationResolver,
      { provide: MockTicketReadService, useValue: mocks.ticketRead },
      { provide: MockTicketWriteService, useValue: mocks.ticketWrite },
      { provide: MockScanService, useValue: mocks.scan },
    ],
  })
    .overrideGuard(CookieAuthGuard)
    .useValue(authGuard)
    .overrideGuard(RoleGuard)
    .useValue(authGuard)
    .compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );
  await app.init();

  return { app, mocks };
}

export async function graphqlRequest<TData>(
  app: INestApplication,
  query: string,
  variables?: Record<string, unknown>,
): Promise<GraphQLResponse<TData>> {
  const fastify = app.getHttpAdapter().getInstance() as FastifyInjectable;
  const response = await fastify.inject({
    method: 'POST',
    url: '/graphql',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.9',
      'user-agent': 'ticket-resolver-e2e',
    },
    payload: JSON.stringify({ query, variables }),
  });

  return {
    body: JSON.parse(response.payload) as GraphQLResponse<TData>['body'],
  };
}
