-- New tickets start without a consumed nonce. Repair unscanned rows created
-- with the former last_nonce=1 default before dropping that default.
UPDATE "ticket" AS t
SET "last_nonce" = NULL
WHERE t."last_nonce" = 1
  AND t."next_nonce" = 1
  AND NOT EXISTS (
    SELECT 1
    FROM "scan_log" AS s
    WHERE s."ticket_id" = t."id"
  );

ALTER TABLE "ticket"
ALTER COLUMN "last_nonce" DROP DEFAULT;
