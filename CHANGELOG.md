# 🧾 Changelog

All notable changes in this project will be documented in this file.


## [3.4.4](https://github.com/omnixys/ticket-service/compare/v3.4.3...v3.4.4) (2026-08-26)

### Build

* **Build:** fix build errors ([](https://github.com/omnixys/ticket-service/commit/932bb40e73d934791e2af4152fca283a00bdb6ad))

## [3.4.3](https://github.com/omnixys/ticket-service/compare/v3.4.2...v3.4.3) (2026-08-26)

### Build

* **Build:** fix build errors ([](https://github.com/omnixys/ticket-service/commit/ce19053e8c3f714ca207637999e75286888ab644))

### Other

* **Other:** Merge branch 'main' of https://github.com/omnixys/ticket-service ([](https://github.com/omnixys/ticket-service/commit/c12e47df8ad5e917b08a6455673bd4904b68dc9a))

## [3.4.2](https://github.com/omnixys/ticket-service/compare/v3.4.1...v3.4.2) (2026-08-26)

### Build

* **Build:** fix build errors ([](https://github.com/omnixys/ticket-service/commit/1c46d425bf406ce3d89273993ac5e1f3c715c00b))

## [3.4.1](https://github.com/omnixys/ticket-service/compare/v3.4.0...v3.4.1) (2026-08-26)

### Deps

* **Deps:** update logger to 3.2.6 ([](https://github.com/omnixys/ticket-service/commit/9235d93065bbb9944f0de1d8fb7603f9bd085dbd))
* **Deps:** update shared TypeScript packages ([](https://github.com/omnixys/ticket-service/commit/1f7594e257cb232cd4876ddf3cdae93d950a1cd8))

## [3.4.0](https://github.com/omnixys/ticket-service/compare/v3.3.3...v3.4.0) (2026-08-26)

### Deps

* **Deps:** update omnixys ts packages ([](https://github.com/omnixys/ticket-service/commit/b991249d757dc3939bf3b6a0efed08c4ee052410))

### Otel

* **Otel:** add otel logs ([](https://github.com/omnixys/ticket-service/commit/34351e0c38fb592fe0fa5d14cbf8b6e82abc2d80))

## [3.3.3](https://github.com/omnixys/ticket-service/compare/v3.3.2...v3.3.3) (2026-08-23)

### Logger

* **Logger:** fix terminal logger ([](https://github.com/omnixys/ticket-service/commit/c11b63ee25b5289d39d098a6d927050d137301e4))

## [3.3.2](https://github.com/omnixys/ticket-service/compare/v3.3.1...v3.3.2) (2026-08-23)

### Observability

* **Observability:** update dependency ([](https://github.com/omnixys/ticket-service/commit/825cd0d4c24c675fd4ee93d58b5a13ea11ebd310))

## [3.3.1](https://github.com/omnixys/ticket-service/compare/v3.3.0...v3.3.1) (2026-08-19)

### Agent

* **Agent:** add repository development instructions ([](https://github.com/omnixys/ticket-service/commit/bd049c9b67a4305f4c81b27489a7788f125eda9c))

### Ratelimit

* **Ratelimit:** replace deprecated skip option with allowList ([](https://github.com/omnixys/ticket-service/commit/96e40a24024c50d55376f379536a7dba3a9fb895))

### Ticket

* **Ticket:** exclude health endpoints from rate-limit and bump version ([](https://github.com/omnixys/ticket-service/commit/9f0664f14d82559be5531eb96e67f479cf7690ac))

## [3.3.0](https://github.com/omnixys/ticket-service/compare/v3.2.0...v3.3.0) (2026-08-03)

### Analytics

* **Analytics:** publish ticket lifecycle facts ([](https://github.com/omnixys/ticket-service/commit/bedd0b276e7718b072aad29a169d2cc4ff011057))

### Config

* **Config:** require and validate DEFAULT_TENANT_ID ([](https://github.com/omnixys/ticket-service/commit/815909bbf97734907cc9f42dc8c3fff1ce865290))
* **Config:** support trusted proxy address policy ([](https://github.com/omnixys/ticket-service/commit/4b3fee544d77934edc9c6a35006655be4f90d0f7))

### Errors

* **Errors:** adopt secure ticket error handling ([](https://github.com/omnixys/ticket-service/commit/44ae142dc520817162b7eae5d535e9d5f95b2b40))

### Tenant

* **Tenant:** use DEFAULT_TENANT_ID instead of hardcoded 'omnixys' ([](https://github.com/omnixys/ticket-service/commit/9fcbafbb1e13e2a62da2285d8ce201145ce20840))

## [3.2.0](https://github.com/omnixys/ticket-service/compare/v3.1.0...v3.2.0) (2026-07-28)

### Other

* **Other:** Merge branch 'main' of https://github.com/omnixys/ticket-service ([](https://github.com/omnixys/ticket-service/commit/6747d0b464f7becaa319e2d2c1f7576754442ff3))

### Prisma

* **Prisma:** add generated prisma files ([](https://github.com/omnixys/ticket-service/commit/14df802f0807c7b8386bd830115b60e61208a88c))

### Ticket

* **Ticket:** add structured logging to token, verify, shareguard, read, and resolvers ([](https://github.com/omnixys/ticket-service/commit/0260acebe3a616f2963adf3617b5c4c28bf73bc2))
* **Ticket:** add try/catch and structured logging to all 3 Kafka handlers ([](https://github.com/omnixys/ticket-service/commit/e4ba9bafcb5abaf863bda6441fdddbb028b7898a))
* **Ticket:** resolve lint and build errors in logger usage ([](https://github.com/omnixys/ticket-service/commit/08d34a93063143343ef7b1b49d02237fec157e6e)), closes [#logger](https://github.com/omnixys/ticket-service/issues/logger)

## [3.1.0](https://github.com/omnixys/ticket-service/compare/v3.0.0...v3.1.0) (2026-07-24)

### Deps

* **Deps:** remove obsolete/redundant dependencies ([](https://github.com/omnixys/ticket-service/commit/02a8683eb2e072b2d3710b02166e6a4e643ec07d))

### Log

* **Log:** remove logstream dep ([](https://github.com/omnixys/ticket-service/commit/78538e4207eab975b3274dfe5424532ee64b4cd7))

### Logger

* **Logger:** remove Kafka log transport config ([](https://github.com/omnixys/ticket-service/commit/145ccbe4f733602741b5a8cb4ca4733635d87eaa))

## [3.0.0](https://github.com/omnixys/ticket-service/compare/v2.1.0...v3.0.0) (2026-07-16)

### New

* **New:** new service ([](https://github.com/omnixys/ticket-service/commit/78cb5681f88e9fa436f3d29d11aae92758e3e919))

## [2.1.0](https://github.com/omnixys/ticket-service/compare/v2.0.1...v2.1.0) (2026-07-02)

### Deps

* **Deps:** update dependencys ([](https://github.com/omnixys/ticket-service/commit/37ea5c2eaff905f221cf85f990f94613d25b2f4e))

## [2.0.1](https://github.com/omnixys/ticket-service/compare/v2.0.0...v2.0.1) (2026-06-29)

### Kafka

* **Kafka:** update kafka dependency ([](https://github.com/omnixys/ticket-service/commit/3bbd1ec4ef47b5bb3c5ec4baa00dd308d3994c3a))

### Other

* **Other:** Merge branch 'main' of https://github.com/omnixys/ticket-service ([](https://github.com/omnixys/ticket-service/commit/76b953643a682418e41c8043a7b1ebc1d1181cac))

## [2.0.0](https://github.com/omnixys/ticket-service/compare/v1.0.2...v2.0.0) (2026-06-28)

### Dependencies

* **Dependencies:** update Dependecies ([](https://github.com/omnixys/ticket-service/commit/c46e1c08d1d20e54216ab17a3bda63038660e07f))

### Other

* **Other:** Merge branch 'main' of https://github.com/omnixys/ticket-service ([](https://github.com/omnixys/ticket-service/commit/82690a9a5e610aeb9b81e89367bb641e32a1703a))

### Ticket

* **Ticket:** secure ticket lifecycle and replay handling ([](https://github.com/omnixys/ticket-service/commit/95b97ffdbe6fdb34193e67e127aa8bce288ef06b))

## [1.0.2](https://github.com/omnixys/ticket-service/compare/v1.0.1...v1.0.2) (2026-05-25)

### Docker

* **Docker:** Dockerfile ([](https://github.com/omnixys/ticket-service/commit/517fe3bb084216e99fa5c9ee0701522106bc44b2))

### Other

* **Other:** Merge branch 'main' of https://github.com/omnixys/ticket-service ([](https://github.com/omnixys/ticket-service/commit/68b1ac227ec6cb9c4614f30c641d2cfa61a30835))

## [1.0.1](https://github.com/omnixys/ticket-service/compare/v1.0.0...v1.0.1) (2026-05-24)

### Docker

* **Docker:** update pnpm, version ([](https://github.com/omnixys/ticket-service/commit/4ef25b7a3fb2a4754a360c96e517b4fef2434cda))

### Pnpm

* **Pnpm:** add pnpm-lock.yaml ([](https://github.com/omnixys/ticket-service/commit/3737be79402dc3c464f3ca9dcaa1d21c6f455940))

### Prisma

* **Prisma:** update prisma schema ([](https://github.com/omnixys/ticket-service/commit/19659f100b8c3022caf84168cc83434c17f48795))

## 1.0.0 (2026-05-01)

### 1.0.0

* **1.0.0:** Restructure CI workflows and clean repository ([](https://github.com/omnixys/ticket-service/commit/e01d235d021deb5b5dd3fdc8d599a290aef44782))

### Ci

* **Ci:** change serets.SERVICE to vars.SERVICE ([](https://github.com/omnixys/ticket-service/commit/0e81143f69cc25d80a517b5e7e04154007d08ada))
* **Ci:** update CI ([](https://github.com/omnixys/ticket-service/commit/122634cbe85e459e109491f5d562e3d5b312d00d))

### Other

* **Other:** workflow completed ([](https://github.com/omnixys/ticket-service/commit/3d380a028d91455ac9049285bc6e79ac69038915))
* **Other:** workflow completed ([](https://github.com/omnixys/ticket-service/commit/2e1ea79f08f97e9215dfc547e0b88dc32239e0e5))
* **Other:** 1.0.0 ([](https://github.com/omnixys/ticket-service/commit/082556c51e0e8dcffc25088c17c3907e50fac78d))
* **Other:** add .github folder ([](https://github.com/omnixys/ticket-service/commit/d03793e85a2eed8976269f96bd74488bbf5dba39))
* **Other:** add attribute checkedInAt ([](https://github.com/omnixys/ticket-service/commit/84f25bdbd1313461752136fe27a8459479f728dd))
* **Other:** add tests ([](https://github.com/omnixys/ticket-service/commit/8314115b571097fc8bb5a494d36fd0a619b09599))
* **Other:** Create deploy.yml ([](https://github.com/omnixys/ticket-service/commit/3e4528e3e6446710e6ef78395660d7c40851c804))
* **Other:** Create migration.sql ([](https://github.com/omnixys/ticket-service/commit/1bf46ff1d27e970a04a4eeacf1c76d42406294f9))
* **Other:** Merge branch 'main' of https://github.com/omnixys/omnixys-ticket-service ([](https://github.com/omnixys/ticket-service/commit/08a630667259eed33ec0fa1f636c6d0115769401))
* **Other:** Merge branch 'main' of https://github.com/omnixys/omnixys-ticket-service ([](https://github.com/omnixys/ticket-service/commit/f281a55cd087edc334350683a3dbd721fa838ea9))
* **Other:** Merge pull request #5 from omnixys/2-ticket-task-create-postgresql-user-database-and-initial-schema-for-the-ticket-service ([](https://github.com/omnixys/ticket-service/commit/3411cba5db9f388f42872a25e07688b46ddc1518)), closes [#5](https://github.com/omnixys/ticket-service/issues/5)
* **Other:** Merge pull request #6 from omnixys/3-ticket-task-implement-graphql-schema-entities-inputs-dtos-and-payloads ([](https://github.com/omnixys/ticket-service/commit/d356eadcdcad933af682948383bce8c2b3bce514)), closes [#6](https://github.com/omnixys/ticket-service/issues/6)
* **Other:** Merge pull request #7 from omnixys/3-ticket-task-implement-graphql-schema-entities-inputs-dtos-and-payloads ([](https://github.com/omnixys/ticket-service/commit/8ba2b611ab42e76f202a4de1f18fcf6f641ea78d)), closes [#7](https://github.com/omnixys/ticket-service/issues/7)
* **Other:** update ([](https://github.com/omnixys/ticket-service/commit/be04fb088016fad81742cfc2bd4e216516fbbdec))
* **Other:** update ([](https://github.com/omnixys/ticket-service/commit/0ff63271f381d8eaed039509f6819bffb3147fa2))
* **Other:** Update cors.ts ([](https://github.com/omnixys/ticket-service/commit/56278655f1a730db77f0829594a997f4ae8b3e47))
* **Other:** Update deploy.yml ([](https://github.com/omnixys/ticket-service/commit/5d33006bfcf9609d73fd5eaebbc0ae29d10a16dd))
* **Other:** Update deploy.yml ([](https://github.com/omnixys/ticket-service/commit/a2bb51ebf30968d3f20b29e6e9a8e043457a978c))
* **Other:** update DockerFile ([](https://github.com/omnixys/ticket-service/commit/ef0c870d388afbea331a1bda40821a3e675dc28e))
* **Other:** Update env.ts ([](https://github.com/omnixys/ticket-service/commit/996f449b37b82f2fa05c1c507774f0f5fa1fe647))
* **Other:** Update seed.ts ([](https://github.com/omnixys/ticket-service/commit/ba4558fcac0a317268026eb7888c1970b81013c7))

### Prisma

* **Prisma:** update prisma schema ([](https://github.com/omnixys/ticket-service/commit/86188a66325aa07cedaa32ffdc0d6ef79c7f8202))

### Release

* **Release:** v1.0.0 ([](https://github.com/omnixys/ticket-service/commit/beded2eca72d044af8c346ec4a59c82e2830da54))
* **Release:** 1.0.0 [skip ci] ([](https://github.com/omnixys/ticket-service/commit/485c65cd9b3e8ec1fcbb48e5de9e28191f4fe709))
* **Release:** 1.0.1 [skip ci] ([](https://github.com/omnixys/ticket-service/commit/4cae29aac462d4fd93dbcb0a0b68e51a8e097ecd))
* **Release:** 1.0.2 [skip ci] ([](https://github.com/omnixys/ticket-service/commit/492d2e78aaffd46f459a150e2d2a9d4ba43858e7))
* **Release:** 1.0.3 [skip ci] ([](https://github.com/omnixys/ticket-service/commit/5b0ec0b7e3f47a83b0eaf43e55b998381c77a405))
* **Release:** 1.0.4 [skip ci] ([](https://github.com/omnixys/ticket-service/commit/429d36ba07480fbbb3287f7da522231e35866f98))

### Release-ci

* **Release-ci:** add @semantic-release/npm ([](https://github.com/omnixys/ticket-service/commit/01af4b8b5e6d9541a69217c8fdddb918cc670028))
* **Release-ci:** fix Release CI Job ([](https://github.com/omnixys/ticket-service/commit/186641c4eb9e43e3d1c956c53f25f95842057488))

### Service

* **Service:** Bump deps, add omnixys packages, remove legacy ([](https://github.com/omnixys/ticket-service/commit/43d13ff05c2b60ba32cf878ec9a5cff2e5b64b6a))

### Ticket

* **Ticket:** Add device binding, revocation, Valkey adapter & dev tools ([](https://github.com/omnixys/ticket-service/commit/a02c25f394330cafa8081a62ef3b4e14d5aa3624))

### Ticket-service

* **Ticket-service:** implement GraphQL schema, DTOs, inputs and payloads ([](https://github.com/omnixys/ticket-service/commit/dade15871c0a288b11bfdfeee0ae0c5d29519ae3))
* **Ticket-service:** implement GraphQL schema, DTOs, inputs and payloads ([](https://github.com/omnixys/ticket-service/commit/fb7de7a41046789a139743c02d544861405ef27a))
* **Ticket-service:** initialize project structure and base configuration ([](https://github.com/omnixys/ticket-service/commit/ba2fe44d1a94fc035fde82e08edaff031115893b))
* **Ticket-service:** set up PostgreSQL database, schema and Prisma models ([](https://github.com/omnixys/ticket-service/commit/579a43497ebde1eb23e79612073a34310405c550))

### Update

* **Update:** service update ([](https://github.com/omnixys/ticket-service/commit/994815fb9eecfe6ba4365cf671cf2de67e95ff2d))
* **Update:** update package json ([](https://github.com/omnixys/ticket-service/commit/7512bfea883bdc64137dc22ece094dbce0245b53))
* **Update:** update package json ([](https://github.com/omnixys/ticket-service/commit/09381f0622e3725067f9355c8627b9cd401a9a70))

## <small>1.0.4 (2026-02-26)</small>

* fix(release-ci): add @semantic-release/npm ([01af4b8b5e6d9541a69217c8fdddb918cc670028](https://github.com/omnixys/omnixys-ticket-service/commit/01af4b8b5e6d9541a69217c8fdddb918cc670028))

## <small>1.0.3 (2026-02-26)</small>

* fix(release-ci): fix Release CI Job ([186641c4eb9e43e3d1c956c53f25f95842057488](https://github.com/omnixys/omnixys-ticket-service/commit/186641c4eb9e43e3d1c956c53f25f95842057488))

## <small>1.0.2 (2026-02-25)</small>

* fix(ci): change serets.SERVICE to vars.SERVICE ([0e81143f69cc25d80a517b5e7e04154007d08ada](https://github.com/omnixys/omnixys-ticket-service/commit/0e81143f69cc25d80a517b5e7e04154007d08ada))
* Merge branch 'main' of https://github.com/omnixys/omnixys-ticket-service ([f281a55cd087edc334350683a3dbd721fa838ea9](https://github.com/omnixys/omnixys-ticket-service/commit/f281a55cd087edc334350683a3dbd721fa838ea9))

## <small>1.0.1 (2026-02-25)</small>

* fix(ci): update CI ([122634cbe85e459e109491f5d562e3d5b312d00d](https://github.com/omnixys/omnixys-ticket-service/commit/122634cbe85e459e109491f5d562e3d5b312d00d))

## 1.0.0 (2026-02-25)

* feat(): workflow completed ([3d380a028d91455ac9049285bc6e79ac69038915](https://github.com/omnixys/omnixys-ticket-service/commit/3d380a028d91455ac9049285bc6e79ac69038915))
* feat(): workflow completed ([2e1ea79f08f97e9215dfc547e0b88dc32239e0e5](https://github.com/omnixys/omnixys-ticket-service/commit/2e1ea79f08f97e9215dfc547e0b88dc32239e0e5))
* 1.0.0 ([082556c51e0e8dcffc25088c17c3907e50fac78d](https://github.com/omnixys/omnixys-ticket-service/commit/082556c51e0e8dcffc25088c17c3907e50fac78d))
* add .github folder ([d03793e85a2eed8976269f96bd74488bbf5dba39](https://github.com/omnixys/omnixys-ticket-service/commit/d03793e85a2eed8976269f96bd74488bbf5dba39))
* add attribute checkedInAt ([84f25bdbd1313461752136fe27a8459479f728dd](https://github.com/omnixys/omnixys-ticket-service/commit/84f25bdbd1313461752136fe27a8459479f728dd))
* add tests ([8314115b571097fc8bb5a494d36fd0a619b09599](https://github.com/omnixys/omnixys-ticket-service/commit/8314115b571097fc8bb5a494d36fd0a619b09599))
* Create deploy.yml ([3e4528e3e6446710e6ef78395660d7c40851c804](https://github.com/omnixys/omnixys-ticket-service/commit/3e4528e3e6446710e6ef78395660d7c40851c804))
* Create migration.sql ([1bf46ff1d27e970a04a4eeacf1c76d42406294f9](https://github.com/omnixys/omnixys-ticket-service/commit/1bf46ff1d27e970a04a4eeacf1c76d42406294f9))
* Merge pull request #5 from omnixys/2-ticket-task-create-postgresql-user-database-and-initial-schema-for-the-ticket-service ([3411cba5db9f388f42872a25e07688b46ddc1518](https://github.com/omnixys/omnixys-ticket-service/commit/3411cba5db9f388f42872a25e07688b46ddc1518)), closes [#5](https://github.com/omnixys/omnixys-ticket-service/issues/5)
* Merge pull request #6 from omnixys/3-ticket-task-implement-graphql-schema-entities-inputs-dtos-and-payloads ([d356eadcdcad933af682948383bce8c2b3bce514](https://github.com/omnixys/omnixys-ticket-service/commit/d356eadcdcad933af682948383bce8c2b3bce514)), closes [#6](https://github.com/omnixys/omnixys-ticket-service/issues/6)
* Merge pull request #7 from omnixys/3-ticket-task-implement-graphql-schema-entities-inputs-dtos-and-payloads ([8ba2b611ab42e76f202a4de1f18fcf6f641ea78d](https://github.com/omnixys/omnixys-ticket-service/commit/8ba2b611ab42e76f202a4de1f18fcf6f641ea78d)), closes [#7](https://github.com/omnixys/omnixys-ticket-service/issues/7)
* update ([be04fb088016fad81742cfc2bd4e216516fbbdec](https://github.com/omnixys/omnixys-ticket-service/commit/be04fb088016fad81742cfc2bd4e216516fbbdec))
* update ([0ff63271f381d8eaed039509f6819bffb3147fa2](https://github.com/omnixys/omnixys-ticket-service/commit/0ff63271f381d8eaed039509f6819bffb3147fa2))
* Update cors.ts ([56278655f1a730db77f0829594a997f4ae8b3e47](https://github.com/omnixys/omnixys-ticket-service/commit/56278655f1a730db77f0829594a997f4ae8b3e47))
* Update deploy.yml ([5d33006bfcf9609d73fd5eaebbc0ae29d10a16dd](https://github.com/omnixys/omnixys-ticket-service/commit/5d33006bfcf9609d73fd5eaebbc0ae29d10a16dd))
* Update deploy.yml ([a2bb51ebf30968d3f20b29e6e9a8e043457a978c](https://github.com/omnixys/omnixys-ticket-service/commit/a2bb51ebf30968d3f20b29e6e9a8e043457a978c))
* update DockerFile ([ef0c870d388afbea331a1bda40821a3e675dc28e](https://github.com/omnixys/omnixys-ticket-service/commit/ef0c870d388afbea331a1bda40821a3e675dc28e))
* Update env.ts ([996f449b37b82f2fa05c1c507774f0f5fa1fe647](https://github.com/omnixys/omnixys-ticket-service/commit/996f449b37b82f2fa05c1c507774f0f5fa1fe647))
* Update seed.ts ([ba4558fcac0a317268026eb7888c1970b81013c7](https://github.com/omnixys/omnixys-ticket-service/commit/ba4558fcac0a317268026eb7888c1970b81013c7))
* breaking(prisma): update prisma schema ([86188a66325aa07cedaa32ffdc0d6ef79c7f8202](https://github.com/omnixys/omnixys-ticket-service/commit/86188a66325aa07cedaa32ffdc0d6ef79c7f8202))
* feat(ticket-service): implement GraphQL schema, DTOs, inputs and payloads ([dade15871c0a288b11bfdfeee0ae0c5d29519ae3](https://github.com/omnixys/omnixys-ticket-service/commit/dade15871c0a288b11bfdfeee0ae0c5d29519ae3))
* feat(ticket-service): implement GraphQL schema, DTOs, inputs and payloads ([fb7de7a41046789a139743c02d544861405ef27a](https://github.com/omnixys/omnixys-ticket-service/commit/fb7de7a41046789a139743c02d544861405ef27a))
* feat(ticket-service): initialize project structure and base configuration ([ba2fe44d1a94fc035fde82e08edaff031115893b](https://github.com/omnixys/omnixys-ticket-service/commit/ba2fe44d1a94fc035fde82e08edaff031115893b))
* feat(ticket-service): set up PostgreSQL database, schema and Prisma models ([579a43497ebde1eb23e79612073a34310405c550](https://github.com/omnixys/omnixys-ticket-service/commit/579a43497ebde1eb23e79612073a34310405c550))

## <small>1.0.1 (2025-11-07)</small>

- Initial commit ([135641e](https://github.com/omnixys/omnixys-ticket-service/commit/135641e))

## <small>1.0.1 (2025-11-06)</small>

- chore(dev): integrate custom Commitlint formatter with Husky hook ([1cc0034](https://github.com/omnixys/omnixys-ticket-service/commit/1cc0034))

## 1.0.0 (2025-11-06)

- chore(ci): add GPL-3.0-or-later license header to all GitHub workflow files ([4b5488c](https://github.com/omnixys/omnixys-ticket-service/commit/4b5488c))
- chore(dev): integrate Husky pre-commit and commit-msg hooks for code quality ([261f18f](https://github.com/omnixys/omnixys-ticket-service/commit/261f18f))
- Initial commit ([7c74f0b](https://github.com/omnixys/omnixys-ticket-service/commit/7c74f0b))
- Update CHANGELOG.md ([e8b2951](https://github.com/omnixys/omnixys-ticket-service/commit/e8b2951))
- Update package.json ([f180269](https://github.com/omnixys/omnixys-ticket-service/commit/f180269))
