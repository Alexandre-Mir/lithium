-- ============================================================
-- LITHIUM v1.1 — Migração
-- ============================================================

-- subjects: campos de ementa e professor
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS professor TEXT NOT NULL DEFAULT '';
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS syllabus TEXT;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS objectives TEXT;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS methodology TEXT;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS assessment TEXT;

-- readings: capítulo e DOI
ALTER TABLE readings ADD COLUMN IF NOT EXISTS chapter_title TEXT;
ALTER TABLE readings ADD COLUMN IF NOT EXISTS doi TEXT;

-- Forçar recarga do schema cache do PostgREST
NOTIFY pgrst, 'reload schema';
