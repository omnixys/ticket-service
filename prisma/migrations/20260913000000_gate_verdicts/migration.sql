-- Gate handling: explicitly distinguish policy-rejected direction scans.
-- ALREADY_INSIDE: ENTRY scan while the guest is already inside.
-- NOT_INSIDE: EXIT scan while the guest is not inside.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'scan_verdict'::regtype AND enumlabel = 'ALREADY_INSIDE'
  ) THEN
    ALTER TYPE "scan_verdict" ADD VALUE IF NOT EXISTS 'ALREADY_INSIDE';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'scan_verdict'::regtype AND enumlabel = 'NOT_INSIDE'
  ) THEN
    ALTER TYPE "scan_verdict" ADD VALUE IF NOT EXISTS 'NOT_INSIDE';
  END IF;
END $$;