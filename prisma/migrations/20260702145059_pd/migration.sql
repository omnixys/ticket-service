-- CreateTable
CREATE TABLE "event_settings_projection" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "name" TEXT,
    "ends_at" TIMESTAMP(3),
    "starts_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "event_settings_projection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_settings_projection_event_id_key" ON "event_settings_projection"("event_id");
