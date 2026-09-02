-- Ticket.revokedBy references a UserId (U), align UUID type.
-- Values are (re)seeded as UUIDs after the UUIDv7 migration, plain casts are safe.
ALTER TABLE "ticket"
    ALTER COLUMN "revoked_by" TYPE UUID USING "revoked_by"::uuid;

-- analytics_outbox.actor_id references a UserId (U), align UUID type.
ALTER TABLE "analytics_outbox"
    ALTER COLUMN "actor_id" TYPE UUID USING "actor_id"::uuid;