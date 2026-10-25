-- ============================================================
-- LITHIUM — Migração v1.4 (app v0.5)
-- Progresso agregado por leitura
-- ============================================================

CREATE OR REPLACE VIEW reading_progress
WITH (security_invoker = true) AS
SELECT
  r.id                                      AS reading_id,
  COUNT(s.id)::int                          AS sessions,
  COALESCE(SUM(s.pages_read), 0)::int       AS pages_read,
  COALESCE(SUM(s.duration_minutes), 0)::int AS total_minutes
FROM readings r
LEFT JOIN reading_sessions s ON s.reading_id = r.id
GROUP BY r.id;

GRANT SELECT ON reading_progress TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
