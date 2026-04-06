/*
  Warnings:

  - You are about to drop the column `by_user_id` on the `scan_log` table. All the data in the column will be lost.
  - You are about to drop the column `device_hash` on the `scan_log` table. All the data in the column will be lost.
  - You are about to drop the column `device_hash` on the `ticket` table. All the data in the column will be lost.
  - You are about to drop the column `rotation_seconds` on the `ticket` table. All the data in the column will be lost.
  - Added the required column `actor_id` to the `scan_log` table without a default value. This is not possible if the table is not empty.
  - Made the column `seat_id` on table `ticket` required. This step will fail if there are existing NULL values in that column.
  - Made the column `guest_profile_id` on table `ticket` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "idx_device_hash_nonce";

-- DropIndex
DROP INDEX "ticket_device_public_key_key";

-- DropIndex
DROP INDEX "ticket_guest_profile_id_key";

-- AlterTable
ALTER TABLE "scan_log" DROP COLUMN "by_user_id",
DROP COLUMN "device_hash",
ADD COLUMN     "actor_id" TEXT NOT NULL,
ADD COLUMN     "device_id" TEXT;

-- AlterTable
ALTER TABLE "ticket" DROP COLUMN "device_hash",
DROP COLUMN "rotation_seconds",
ADD COLUMN     "device_id" TEXT,
ALTER COLUMN "seat_id" SET NOT NULL,
ALTER COLUMN "guest_profile_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "idx_scanlog_ticket_ts" ON "scan_log"("ticket_id", "created_at");
