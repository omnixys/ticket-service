/*
  Warnings:

  - You are about to drop the column `last_rotated_at` on the `ticket` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ticket" DROP COLUMN "last_rotated_at",
ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "revokedBy" TEXT,
ADD COLUMN     "revokedReason" TEXT;
