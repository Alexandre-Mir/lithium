-- ============================================================
-- LITHIUM — Migração v1.3 (app v0.4)
-- Velocidade agregada por tipo de leitura
-- ============================================================

CREATE OR REPLACE VIEW reading_speed_stats
WITH (security_invoker = true) AS
SELECT
  r.type::text                               AS reading_type,
  COUNT(*)::int                              AS sessions,
  COALESCE(SUM(s.pages_read), 0)::int        AS total_pages,
  COALESCE(SUM(s.duration_minutes), 0)::int  AS total_minutes
FROM reading_sessions s
JOIN readings r ON r.id = s.reading_id
GROUP BY r.type;

GRANT SELECT ON reading_speed_stats TO anon, authenticated;

NOTIFY pgrst, 'reload schema';