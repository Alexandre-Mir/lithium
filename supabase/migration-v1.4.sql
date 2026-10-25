-- ============================================================
-- LITHIUM — Migração v1.4 (app v0.5)
-- Progresso agregado por leitura
-- ============================================================

CREATE OR REPLACE VIEW reading_progress
WITH (security_invoker = true) AS
SELECT
  reading_id,
  COUNT(*)::int                              AS sessions,
  COALESCE(SUM(pages_read), 0)::int          AS pages_read,
  COALESCE(SUM(duration_minutes), 0)::int    AS total_minutes
FROM reading_sessions
GROUP BY reading_id;

GRANT SELECT ON reading_progress TO anon, authenticated;

NOTIFY pgrst, 'reload schema';