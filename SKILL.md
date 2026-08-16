<!-- repository: services/ticket | kind: SERVICE | stack: nestjs -->

# ticket — Skill: Service Development

> Workflow for ticket (services/ticket). Execute this workflow before, during, and
> after changes in this repository.

## Repository Facts

- Kind: Service
- Package: `ticket-service` (version: 3.3.0)
- Runtime: Node >=25.8.2 (pnpm >=10.33.0)
- Description: Omnixys Ticket Service – tickets, presence/state transitions, admin, analytics.
- Architecture: src/adapter, admin, analytics, config, core, dev, handlers, prisma, security, ticket
- Database: PostgreSQL via Prisma (prisma/schema.prisma); Migrations: Prisma Migrate (prisma:migrate / generate / validate)
- API: GraphQL (NestJS Apollo Federation)
- Messaging: Kafka (kafkajs + @omnixys/kafka-ts)
- Tests: node --test __tests__/unit/*.test.mjs; Jest e2e


## Workflow

### 1. Understand the change

- Identify the affected bounded context within `src/adapter, admin, analytics, config, core, dev, handlers, prisma, security, ticket`.
- Inspect consumers of the GraphQL operations and Kafka events you may touch.
- Never weaken authentication or authorization to make a test pass.

### 2. Implement

- Follow the existing module layout and naming conventions.
- Reuse `omnixys/packages` (shared contracts, cache, kafka, observability, security, ...)
  before reimplementing shared infrastructure.
- Keep tenant isolation intact (`State-machine semantics for ticket presence transitions; tenant isolation mandatory.`).

### 3. Write tests

- Unit tests exercise isolated business behavior.
- Integration tests cover repository/Prisma, GraphQL, Kafka, and auth boundaries.
- Cover tenant-isolation and error-contract cases when the code path touches them.

### 4. Validate

## Validation

Run each applicable check and record the result as `PASS`, `FAIL`, `PRE-EXISTING
FAILURE`, or `NOT RUN` (with a reason). Never convert `NOT RUN` into `PASS`.

  - `pnpm install --frozen-lockfile`
  - `pnpm format:check`
  - `pnpm exec eslint "{src,apps,libs,test}/**/*.ts"  (check-only)`
  - `npx tsc -p tsconfig.json --noEmit`
  - `pnpm run test:unit`
  - `pnpm run test:e2e (jest, infrastructure-dependent)`
  - `pnpm build`
  - `pnpm test`

## Commit

- Use Conventional Commits (`<type>(<scope>): <summary>`), e.g. `feat`, `fix`, `refactor`, `test`, `docs`, `build`, `ci`, `perf`.
- Stage only files belonging to the logical change. Run `git diff --check` before committing.
- Commit locally; never push.

## Definition of Done

See the "Definition of Done" section in `AGENTS.md`. Before finishing, confirm
`AGENTS.md` and `SKILL.md` remain accurate for this repository.
