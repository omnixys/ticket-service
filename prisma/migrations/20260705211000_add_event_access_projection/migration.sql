ALTER TYPE "event_role_type" ADD VALUE IF NOT EXISTS 'SUPPORT';

CREATE TABLE "event_access_projection" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "roles" JSONB,
    "occurred_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "event_access_projection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_event_access_projection" ON "event_access_projection"("event_id", "user_id");
CREATE INDEX "idx_event_access_projection_event" ON "event_access_projection"("event_id");
