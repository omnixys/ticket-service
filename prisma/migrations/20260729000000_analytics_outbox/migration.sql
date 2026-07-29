CREATE TABLE "analytics_outbox" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "topic" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "correlation_id" TEXT,
  "actor_id" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_at" TIMESTAMP(3),
  "locked_by" TEXT,
  "published_at" TIMESTAMP(3),
  "dead_lettered_at" TIMESTAMP(3),
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analytics_outbox_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "analytics_outbox_published_at_dead_lettered_at_next_attempt_at_idx"
  ON "analytics_outbox"("published_at", "dead_lettered_at", "next_attempt_at");
