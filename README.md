# Omnixys Ticket Service

The Ticket Service owns admission tickets, device binding, short-lived QR credentials, replay protection, presence transitions, scan logs, revocation, and ticket anti-sharing state. It exposes a federated GraphQL API and consumes identity/event lifecycle commands through Kafka.

## Ownership boundaries

This service owns:

- one ticket per invitation and one ticket per guest per event;
- one ticket per seat;
- P-256 device binding;
- encrypted and signed short-lived QR tokens;
- nonce rotation and replay prevention;
- venue presence transitions and scan audit logs;
- manual revocation and anti-sharing state.

It does not own invitations, event configuration, seats, user identity, access-token verification, or telemetry/logging transports. Those responsibilities remain with their domain services and the corresponding Omnixys packages.

## Architecture

```text
HTTP / GraphQL
      |
      v
Context + Security + Validation
      |
      v
Ticket resolvers/services ----------> PostgreSQL
      |                    `--------> Valkey replay guards
      v
Kafka package ----> Invitation linkage / Event milestones
```

`@omnixys/context-ts` is the canonical source for request, correlation, actor, tenant, and trace metadata. `@omnixys/logger-ts`, structured errors, Kafka headers, and event metadata consume those same values.

## Ticket lifecycle

1. Authentication completes guest verification and publishes `ticket.create` with a short-lived verification token.
2. The handler validates the cached ticket mapping and creates the ticket idempotently.
3. The service publishes a stable `TICKET_GENERATED` event milestone.
4. The handler links the guest profile back to the invitation.
5. The ticket owner binds one P-256 public key and device ID.
6. The owner requests a short-lived QR token containing the next nonce.
7. An administrator scans the signed token. Signature, device, revocation, blocking, nonce, and replay checks run before the presence transition.
8. A successful scan atomically rotates the nonce, writes an audit log, and emits a `TICKET_SCANNED` milestone.

Ticket creation is idempotent. Re-delivery of the same Kafka message returns the existing matching ticket and republishes the same stable milestone identifier. A conflicting event, guest, or seat mapping fails with `TICKET_ALREADY_EXISTS` and can proceed through Kafka retry/dead-letter handling.

## Security model

- QR payloads are signed with HS256 and encrypted with A256GCM.
- Signing keys are selected by `kid`; `QR_ACTIVE_KID` supports rotation.
- Device signatures use P-256 ECDSA with SHA-256 and DER signatures.
- Device binding is owner-only and immutable after the first successful binding.
- Token generation is owner-only.
- Ticket reads enforce owner access unless the authenticated user is an administrator.
- Event-wide queries, scanning, deletion, revocation, and administrative process endpoints require the `ADMIN` realm role.
- Replay acquisition uses one atomic Valkey `SET NX EX` operation.
- Nonce rotation also uses a database compare-and-set, preventing two concurrent scans from succeeding.

Never expose `QR_JWE_KEY`, `QR_JWS_KEYS`, private device keys, or raw access tokens in logs or API payloads.

## Interfaces

### GraphQL

Owner operations:

- `ticketById`, `ticketByInvitation`, `ticketsByGuest`, and `getMyTickets`;
- `activateDevice`;
- `generateToken`;
- owner-visible scan logs.

Administrator operations:

- `getAllTickets` and `ticketsByEvent`;
- `scanToken`;
- `deleteTicket` and `revokeTicket`.

All operations use cookie authentication. Global DTO transformation and validation are enabled.

### HTTP

- `GET /health/liveness` checks the process.
- `GET /health/readiness` checks Kafka, Valkey, and explicitly configured external dependencies.
- `/admin/*` requires the `ADMIN` role.
- `/dev/*` is registered only when `ENABLE_DEV_ENDPOINTS=true` and `NODE_ENV` is not `production`.

### Kafka

Consumed topics:

| Topic registry key          | Responsibility                              |
| --------------------------- | ------------------------------------------- |
| `ticket.create`             | Create a verified guest ticket idempotently |
| `ticket.deleteUserTickets`  | Delete all tickets owned by a removed user  |
| `ticket.deleteEventTickets` | Delete tickets for removed events           |

Produced topics:

| Topic registry key        | Responsibility                                    |
| ------------------------- | ------------------------------------------------- |
| `invitation.addGuestId`   | Link the verified guest profile to its invitation |
| `event.milestoneRecorded` | Record generated, scanned, and revoked milestones |

The earlier `invitationUpdated`, `ticketScanned`, and `userSignedUp` TODO concepts are represented by canonical cross-service flows: invitation linkage, ticket milestones, and the Authentication-owned guest verification event. A second service-local subscription system would duplicate ownership and was intentionally not introduced.

## Persistence and migrations

PostgreSQL stores tickets, scan logs, and share-guard state. Valkey stores only short-lived replay guards and verification mappings.

Run migrations before deployment:

```bash
pnpm prisma migrate deploy
```

`20260622002000_fix_ticket_nonce` repairs unscanned tickets created with the old `last_nonce=1` default and drops that default. New tickets start with no consumed nonce and `nextNonce=1`, so their first scan is valid.

## Local development

Requirements:

- Node.js 24.10 or newer;
- pnpm 11.1 or newer;
- PostgreSQL;
- Kafka;
- Valkey;
- a compatible JWT issuer.

Setup:

```bash
cp .env.example .env
pnpm install
pnpm prisma migrate dev
pnpm dev
```

Generate local QR secrets with `openssl rand -base64 32`. `QR_JWS_KEYS` must be a JSON object whose values decode to at least 32 bytes. `QR_ACTIVE_KID` must name one entry.

Important environment variables:

| Variable               | Purpose                       | Development default       |
| ---------------------- | ----------------------------- | ------------------------- |
| `PORT`                 | HTTP/GraphQL port             | `4000`                    |
| `DATABASE_URL`         | PostgreSQL connection         | none                      |
| `KAFKA_BROKER`         | Kafka bootstrap broker        | `localhost:9092`          |
| `VALKEY_URL`           | Replay and verification store | `valkey://localhost:6380` |
| `QR_JWE_KEY`           | 32-byte JWE key               | none                      |
| `QR_JWS_KEYS`          | versioned signing key map     | none                      |
| `QR_ACTIVE_KID`        | active signing key            | `v1`                      |
| `ENABLE_DEV_ENDPOINTS` | registers local diagnostics   | `false`                   |
| `TEMPO_URI`            | OTLP HTTP trace endpoint      | local collector           |

Production startup rejects missing database, cookie, Keycloak client, Valkey, and service encryption secrets. QR key configuration is always validated when the token service is constructed.

## Validation and tests

```bash
pnpm prisma validate
pnpm build
pnpm test:unit
pnpm test:e2e
pnpm lint
pnpm pack --dry-run
```

Unit tests exercise JWS/JWE round trips, canonical token errors, real P-256 signatures, nonce rotation, replay detection, idempotent Kafka creation, and expired verification state. GraphQL E2E tests boot an in-memory Nest/Fastify application with controlled security and service collaborators; they require no external infrastructure.

## Operational behavior

Nest shutdown hooks close Kafka, Valkey, telemetry, logging, and Prisma through package lifecycle APIs. Readiness reports Kafka and cache state separately. Optional Keycloak, Tempo, and Prometheus checks are disabled when their URLs are empty.

Successful scans are never rolled back because an informational timeline publication fails. Such publication failures are logged with canonical diagnostics; the scan log remains the authoritative audit record.

Framework exceptions expose stable codes plus request, correlation, trace, actor, and tenant identifiers. Consumers should branch on the code rather than message text.

## Troubleshooting

- First scans reported as replay indicate the nonce migration has not been applied.
- `TICKET_DEVICE_KEY_INVALID` means the submitted key is not a DER-encoded P-256 SPKI public key.
- `TICKET_TOKEN_INVALID` means decryption, signature verification, key selection, or expiration validation failed.
- A readiness failure identifies `kafka` or `cache`; verify that dependency and its credentials.
- Do not enable dev endpoints in shared environments. Production ignores the flag by design.

## License

GPL-3.0-or-later. See [.github/LICENSE](.github/LICENSE).
