-- ============================================================
-- LITHIUM — Migração v1.5 (app v0.5)
-- Tempo real de leitura: segundos, início/fim e origem da sessão
-- Só expande o schema: nada é apagado e o app antigo continua gravando.
-- ============================================================

BEGIN;

ALTER TABLE reading_sessions ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;
ALTER TABLE reading_sessions ADD COLUMN IF NOT EXISTS started_at       TIMESTAMPTZ;
ALTER TABLE reading_sessions ADD COLUMN IF NOT EXISTS ended_at         TIMESTAMPTZ;
ALTER TABLE reading_sessions ADD COLUMN IF NOT EXISTS source           TEXT NOT NULL DEFAULT 'manual';

-- sessões antigas: segundos exatos (minutos × 60)
UPDATE reading_sessions
   SET duration_seconds = duration_minutes * 60
 WHERE duration_seconds IS NULL;

ALTER TABLE reading_sessions DROP CONSTRAINT IF EXISTS reading_sessions_duration_seconds_check;
ALTER TABLE reading_sessions ADD  CONSTRAINT reading_sessions_duration_seconds_check
  CHECK (duration_seconds IS NULL OR duration_seconds > 0);

ALTER TABLE reading_sessions DROP CONSTRAINT IF EXISTS reading_sessions_source_check;
ALTER TABLE reading_sessions ADD  CONSTRAINT reading_sessions_source_check
  CHECK (source IN ('manual', 'timer', 'timer_adjusted'));

CREATE INDEX IF NOT EXISTS idx_sessions_started ON reading_sessions (started_at);

-- views: colunas antigas intactas; total_seconds acrescentada no fim
CREATE OR REPLACE VIEW reading_progress
WITH (security_invoker = true) AS
SELECT
  reading_id,
  COUNT(*)::int                                                                           AS sessions,
  COALESCE(SUM(pages_read), 0)::int                                                       AS pages_read,
  ROUND(COALESCE(SUM(COALESCE(duration_seconds, duration_minutes * 60)), 0) / 60.0)::int  AS total_minutes,
  COALESCE(SUM(COALESCE(duration_seconds, duration_minutes * 60)), 0)::int                AS total_seconds
FROM reading_sessions
GROUP BY reading_id;

CREATE OR REPLACE VIEW reading_speed_stats
WITH (security_invoker = true) AS
SELECT
  r.type::text                                                                              AS reading_type,
  COUNT(*)::int                                                                             AS sessions,
  COALESCE(SUM(s.pages_read), 0)::int                                                       AS total_pages,
  ROUND(COALESCE(SUM(COALESCE(s.duration_seconds, s.duration_minutes * 60)), 0) / 60.0)::int AS total_minutes,
  COALESCE(SUM(COALESCE(s.duration_seconds, s.duration_minutes * 60)), 0)::int              AS total_seconds
FROM reading_sessions s
JOIN readings r ON r.id = s.reading_id
GROUP BY r.type;

GRANT SELECT ON reading_progress, reading_speed_stats TO anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';