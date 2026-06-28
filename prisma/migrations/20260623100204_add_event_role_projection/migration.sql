-- CreateEnum
CREATE TYPE "event_role_type" AS ENUM ('ADMIN', 'SECURITY', 'GUEST');

-- CreateTable
CREATE TABLE "event_role_projection" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "event_role_type" NOT NULL,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "event_role_projection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_event_role_projection_event" ON "event_role_projection"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_role_projection_event_id_user_id_key" ON "event_role_projection"("event_id", "user_id");
