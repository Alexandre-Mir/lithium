-- ============================================================
-- LITHIUM — Motor Cognitivo de Estudos
-- Schema v1.9 (Totalmente idempotente e seguro contra reexecuções)
-- ============================================================

-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Enums (Idempotentes - não falham se já existirem)
DO $$ BEGIN
  CREATE TYPE reading_type AS ENUM ('book', 'article');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE review_status AS ENUM ('pending', 'done');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Helper: trigger para updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TABELA 1: subjects (Disciplinas)
-- ============================================================
CREATE TABLE IF NOT EXISTS subjects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  professor     TEXT NOT NULL DEFAULT '',
  syllabus      TEXT,
  objectives    TEXT,
  methodology   TEXT,
  assessment    TEXT,
  is_autonomous BOOLEAN NOT NULL DEFAULT false,
  class_days    TEXT[] NOT NULL DEFAULT '{}',
  theme_color   TEXT NOT NULL DEFAULT '#6366f1',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Garantir colunas novas caso a tabela já existisse
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS professor TEXT NOT NULL DEFAULT '';
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS syllabus TEXT;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS objectives TEXT;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS methodology TEXT;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS assessment TEXT;

DROP TRIGGER IF EXISTS subjects_updated_at ON subjects;
CREATE TRIGGER subjects_updated_at
  BEFORE UPDATE ON subjects
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ============================================================
-- TABELA 2: deliverables (Entregas / Provas)
-- ============================================================
CREATE TABLE IF NOT EXISTS deliverables (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id  UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  date        DATE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deliverables_subject ON deliverables(subject_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_date    ON deliverables(date);

DROP TRIGGER IF EXISTS deliverables_updated_at ON deliverables;
CREATE TRIGGER deliverables_updated_at
  BEFORE UPDATE ON deliverables
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ============================================================
-- TABELA 3: readings (Leituras)
-- ============================================================
CREATE TABLE IF NOT EXISTS readings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id          UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  chapter_title       TEXT,
  author              TEXT,
  type                reading_type NOT NULL DEFAULT 'book',
  isbn                TEXT,
  doi                 TEXT,
  full_book_pages     INTEGER,
  target_pages        INTEGER NOT NULL DEFAULT 0,
  read_full_book      BOOLEAN NOT NULL DEFAULT false,
  deadline            DATE,
  is_read             BOOLEAN NOT NULL DEFAULT false,
  current_speed_pph   NUMERIC(6, 2) NOT NULL DEFAULT 20.00,
  cover_url           TEXT,
  publisher           TEXT,
  published_year      INTEGER,
  metadata_source     TEXT,
  metadata_fetched_at TIMESTAMPTZ,
  milestones          JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Garantir colunas novas caso a tabela já tenha sido criada antes
ALTER TABLE readings ADD COLUMN IF NOT EXISTS author TEXT;
ALTER TABLE readings ADD COLUMN IF NOT EXISTS chapter_title TEXT;
ALTER TABLE readings ADD COLUMN IF NOT EXISTS doi TEXT;
ALTER TABLE readings ADD COLUMN IF NOT EXISTS full_book_pages INTEGER;
ALTER TABLE readings ADD COLUMN IF NOT EXISTS read_full_book BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE readings ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE readings ADD COLUMN IF NOT EXISTS publisher TEXT;
ALTER TABLE readings ADD COLUMN IF NOT EXISTS published_year INTEGER;
ALTER TABLE readings ADD COLUMN IF NOT EXISTS metadata_source TEXT;
ALTER TABLE readings ADD COLUMN IF NOT EXISTS metadata_fetched_at TIMESTAMPTZ;
ALTER TABLE readings ADD COLUMN IF NOT EXISTS milestones JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE readings ALTER COLUMN deadline DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_readings_subject  ON readings(subject_id);
CREATE INDEX IF NOT EXISTS idx_readings_deadline ON readings(deadline);
CREATE INDEX IF NOT EXISTS idx_readings_is_read  ON readings(is_read);

DROP TRIGGER IF EXISTS readings_updated_at ON readings;
CREATE TRIGGER readings_updated_at
  BEFORE UPDATE ON readings
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ============================================================
-- TABELA 4: reading_sessions (Log de Sessões — Autorregulação)
-- ============================================================
CREATE TABLE IF NOT EXISTS reading_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reading_id       UUID NOT NULL REFERENCES readings(id) ON DELETE CASCADE,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  duration_seconds INTEGER,
  started_at       TIMESTAMPTZ,
  ended_at         TIMESTAMPTZ,
  source           TEXT NOT NULL DEFAULT 'manual',
  pages_read       INTEGER NOT NULL CHECK (pages_read > 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE reading_sessions ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;
ALTER TABLE reading_sessions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE reading_sessions ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
ALTER TABLE reading_sessions ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

UPDATE reading_sessions
   SET duration_seconds = duration_minutes * 60
 WHERE duration_seconds IS NULL;

ALTER TABLE reading_sessions DROP CONSTRAINT IF EXISTS reading_sessions_duration_seconds_check;
ALTER TABLE reading_sessions ADD CONSTRAINT reading_sessions_duration_seconds_check
  CHECK (duration_seconds IS NULL OR duration_seconds > 0);

ALTER TABLE reading_sessions DROP CONSTRAINT IF EXISTS reading_sessions_source_check;
ALTER TABLE reading_sessions ADD CONSTRAINT reading_sessions_source_check
  CHECK (source IN ('manual', 'timer', 'timer_adjusted'));

CREATE INDEX IF NOT EXISTS idx_sessions_reading ON reading_sessions(reading_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON reading_sessions(started_at);

-- ============================================================
-- TABELA 5: spaced_reviews (Gatilhos de Repetição Espaçada)
-- ============================================================
CREATE TABLE IF NOT EXISTS spaced_reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reading_id  UUID NOT NULL REFERENCES readings(id) ON DELETE CASCADE,
  review_date DATE NOT NULL,
  status      review_status NOT NULL DEFAULT 'pending',
  type        TEXT NOT NULL DEFAULT 'active_recall',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_date    ON spaced_reviews(review_date);
CREATE INDEX IF NOT EXISTS idx_reviews_status  ON spaced_reviews(status);
CREATE INDEX IF NOT EXISTS idx_reviews_reading ON spaced_reviews(reading_id);

-- ============================================================
-- TABELA 6: app_settings (Preferências globais do app pessoal)
-- ============================================================
CREATE TABLE IF NOT EXISTS app_settings (
  id                 SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  daily_goal_minutes INTEGER NOT NULL DEFAULT 60
                     CHECK (daily_goal_minutes BETWEEN 1 AND 1440),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_settings (id, daily_goal_minutes)
VALUES (1, 60)
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS app_settings_updated_at ON app_settings;
CREATE TRIGGER app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ============================================================
-- TABELA 7: milestone_summaries (Resumos de Revisão Ativa)
-- ============================================================
CREATE TABLE IF NOT EXISTS milestone_summaries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id         UUID NOT NULL REFERENCES readings(id) ON DELETE CASCADE,
  milestone_title TEXT NOT NULL,
  milestone_page  INTEGER NOT NULL CHECK (milestone_page >= 1),
  content         TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'review', 'completed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_milestone_summaries_user_book_milestone
  ON milestone_summaries (user_id, book_id, milestone_page, milestone_title);
CREATE INDEX IF NOT EXISTS idx_milestone_summaries_user_status
  ON milestone_summaries (user_id, status, created_at DESC);

DROP TRIGGER IF EXISTS milestone_summaries_updated_at ON milestone_summaries;
CREATE TRIGGER milestone_summaries_updated_at
  BEFORE UPDATE ON milestone_summaries
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Índice único para upsert idempotente por leitura, data e tipo
CREATE UNIQUE INDEX IF NOT EXISTS uq_reviews_reading_date_type
  ON spaced_reviews (reading_id, review_date, type);

-- ============================================================
-- Row Level Security: Acesso total (app pessoal, sem auth)
-- ============================================================
ALTER TABLE subjects         ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliverables     ENABLE ROW LEVEL SECURITY;
ALTER TABLE readings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE spaced_reviews   ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestone_summaries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Allow all" ON subjects FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow all" ON deliverables FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow all" ON readings FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow all" ON reading_sessions FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow all" ON spaced_reviews FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow all" ON app_settings FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DROP POLICY IF EXISTS "Allow all" ON milestone_summaries;
DROP POLICY IF EXISTS "Users manage own milestone summaries" ON milestone_summaries;
CREATE POLICY "Users manage own milestone summaries"
  ON milestone_summaries
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

REVOKE ALL ON TABLE milestone_summaries FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE milestone_summaries TO authenticated;

-- ============================================================
-- VIEW: velocidade agregada por tipo de leitura (v1.3)
-- ============================================================
CREATE OR REPLACE VIEW reading_speed_stats
WITH (security_invoker = true) AS
SELECT
  r.type::text                               AS reading_type,
  COUNT(*)::int                              AS sessions,
  COALESCE(SUM(s.pages_read), 0)::int        AS total_pages,
  ROUND(COALESCE(SUM(COALESCE(s.duration_seconds, s.duration_minutes * 60)), 0) / 60.0)::int AS total_minutes,
  COALESCE(SUM(COALESCE(s.duration_seconds, s.duration_minutes * 60)), 0)::int AS total_seconds
FROM reading_sessions s
JOIN readings r ON r.id = s.reading_id
GROUP BY r.type;

GRANT SELECT ON reading_speed_stats TO anon, authenticated;

-- ============================================================
-- VIEW: progresso agregado por leitura (v1.4 + tempo real v1.5)
-- ============================================================
CREATE OR REPLACE VIEW reading_progress
WITH (security_invoker = true) AS
SELECT
  reading_id,
  COUNT(*)::int AS sessions,
  COALESCE(SUM(pages_read), 0)::int AS pages_read,
  ROUND(COALESCE(SUM(COALESCE(duration_seconds, duration_minutes * 60)), 0) / 60.0)::int AS total_minutes,
  COALESCE(SUM(COALESCE(duration_seconds, duration_minutes * 60)), 0)::int AS total_seconds
FROM reading_sessions
GROUP BY reading_id;

GRANT SELECT ON reading_progress TO anon, authenticated;

-- ============================================================
-- NOTIFY POSTGREST: Forçar recarga imediata do schema cache
-- ============================================================
NOTIFY pgrst, 'reload schema';
