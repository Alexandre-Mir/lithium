-- ============================================================
-- LITHIUM — Migração v1.2 (app v0.3)
-- ============================================================

-- 1) readings: metadados externos persistidos
ALTER TABLE readings ADD COLUMN IF NOT EXISTS cover_url           TEXT;
ALTER TABLE readings ADD COLUMN IF NOT EXISTS publisher           TEXT;
ALTER TABLE readings ADD COLUMN IF NOT EXISTS published_year      INTEGER;
ALTER TABLE readings ADD COLUMN IF NOT EXISTS metadata_source     TEXT;         -- 'google_books' | 'open_library' | 'crossref'
ALTER TABLE readings ADD COLUMN IF NOT EXISTS metadata_fetched_at TIMESTAMPTZ;   -- NULL = nunca consultado

-- 2) spaced_reviews: uma revisão por leitura/data/tipo
DELETE FROM spaced_reviews a
USING spaced_reviews b
WHERE a.reading_id = b.reading_id
  AND a.review_date = b.review_date
  AND a.type = b.type
  AND (a.created_at, a.id) > (b.created_at, b.id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_reviews_reading_date_type
  ON spaced_reviews (reading_id, review_date, type);

NOTIFY pgrst, 'reload schema';