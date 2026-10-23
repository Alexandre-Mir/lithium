-- ============================================================
-- LITHIUM — Motor Cognitivo de Estudos
-- Schema v1.1 (Totalmente idempotente e seguro contra reexecuções)
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
  is_autonomous BOOLEAN NOT NULL DEFAULT false,
  class_days    TEXT[] NOT NULL DEFAULT '{}',
  theme_color   TEXT NOT NULL DEFAULT '#6366f1',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id        UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  author            TEXT,
  type              reading_type NOT NULL DEFAULT 'book',
  isbn              TEXT,
  full_book_pages   INTEGER,
  target_pages      INTEGER NOT NULL DEFAULT 0,
  read_full_book    BOOLEAN NOT NULL DEFAULT false,
  deadline          DATE NOT NULL,
  is_read           BOOLEAN NOT NULL DEFAULT false,
  current_speed_pph NUMERIC(6, 2) NOT NULL DEFAULT 20.00,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Garantir colunas novas caso a tabela já tenha sido criada antes
ALTER TABLE readings ADD COLUMN IF NOT EXISTS author TEXT;
ALTER TABLE readings ADD COLUMN IF NOT EXISTS full_book_pages INTEGER;
ALTER TABLE readings ADD COLUMN IF NOT EXISTS read_full_book BOOLEAN NOT NULL DEFAULT false;

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
  pages_read       INTEGER NOT NULL CHECK (pages_read > 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_reading ON reading_sessions(reading_id);

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
-- Row Level Security: Acesso total (app pessoal, sem auth)
-- ============================================================
ALTER TABLE subjects         ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliverables     ENABLE ROW LEVEL SECURITY;
ALTER TABLE readings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE spaced_reviews   ENABLE ROW LEVEL SECURITY;

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

-- ============================================================
-- NOTIFY POSTGREST: Forçar recarga imediata do schema cache
-- ============================================================
NOTIFY pgrst, 'reload schema';
