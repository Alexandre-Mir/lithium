-- Marcos de leitura extraídos do sumário (TOC).
ALTER TABLE readings
  ADD COLUMN IF NOT EXISTS milestones JSONB NOT NULL DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
