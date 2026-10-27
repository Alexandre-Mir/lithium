-- ============================================================
-- Lithium — Migração v1.6
-- Permite leituras sem prazo fixo.
-- ============================================================

BEGIN;

ALTER TABLE readings ALTER COLUMN deadline DROP NOT NULL;

COMMIT;

NOTIFY pgrst, 'reload schema';
