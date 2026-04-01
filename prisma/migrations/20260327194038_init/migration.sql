-- CreateEnum
CREATE TYPE "PresenceState" AS ENUM ('INSIDE', 'OUTSIDE');

-- CreateEnum
CREATE TYPE "ScanVerdict" AS ENUM ('OK', 'REPLAY', 'INVALID_NONCE', 'DEVICE_MISMATCH', 'BLOCKED', 'REVOKED', 'UNKNOWN', 'EXPIRED_EVENT');

-- CreateTable
CREATE TABLE "ticket" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "invitation_id" TEXT NOT NULL,
    "seat_id" TEXT,
    "guest_profile_id" TEXT,
    "device_hash" TEXT,
    "device_public_key" TEXT,
    "device_activation_at" TIMESTAMP(3),
    "device_activation_ip" TEXT,
    "last_nonce" INTEGER,
    "next_nonce" INTEGER,
    "rotation_seconds" INTEGER NOT NULL DEFAULT 30,
    "last_rotated_at" TIMESTAMP(3),
    "checked_in_at" TIMESTAMP(3),
    "current_state" "PresenceState" NOT NULL DEFAULT 'OUTSIDE',
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_log" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "by_user_id" TEXT,
    "direction" "PresenceState" NOT NULL,
    "gate" TEXT,
    "verdict" "ScanVerdict" NOT NULL DEFAULT 'UNKNOWN',
    "nonce" INTEGER,
    "device_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_guard" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "fail_count" INTEGER NOT NULL DEFAULT 0,
    "last_fail_at" TIMESTAMP(3),
    "blocked_until" TIMESTAMP(3),
    "reason" TEXT,

    CONSTRAINT "share_guard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ticket_invitation_id_key" ON "ticket"("invitation_id");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_seat_id_key" ON "ticket"("seat_id");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_guest_profile_id_key" ON "ticket"("guest_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_device_public_key_key" ON "ticket"("device_public_key");

-- CreateIndex
CREATE INDEX "idx_device_hash_nonce" ON "ticket"("device_hash", "last_nonce");

-- CreateIndex
CREATE INDEX "idx_ticket_event" ON "ticket"("event_id");

-- CreateIndex
CREATE INDEX "idx_ticket_guest_profile" ON "ticket"("guest_profile_id");

-- CreateIndex
CREATE INDEX "idx_ticket_seat" ON "ticket"("seat_id");

-- CreateIndex
CREATE INDEX "idx_ticket_state" ON "ticket"("current_state");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_event_id_guest_profile_id_key" ON "ticket"("event_id", "guest_profile_id");

-- CreateIndex
CREATE INDEX "idx_scanlog_nonce" ON "scan_log"("nonce");

-- CreateIndex
CREATE INDEX "idx_scanlog_event_ts" ON "scan_log"("event_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_scanlog_ticket" ON "scan_log"("ticket_id");

-- CreateIndex
CREATE INDEX "idx_scanlog_verdict" ON "scan_log"("verdict");

-- CreateIndex
CREATE UNIQUE INDEX "share_guard_ticket_id_key" ON "share_guard"("ticket_id");

-- CreateIndex
CREATE INDEX "idx_shareguard_blocked" ON "share_guard"("blocked_until");

-- CreateIndex
CREATE INDEX "idx_shareguard_fails" ON "share_guard"("fail_count");

-- AddForeignKey
ALTER TABLE "scan_log" ADD CONSTRAINT "scan_log_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_guard" ADD CONSTRAINT "share_guard_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
