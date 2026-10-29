-- Lithium v1.11: persist the printed first page of a reading excerpt.
ALTER TABLE public.readings
  ADD COLUMN IF NOT EXISTS segment_start_page INTEGER
  CHECK (segment_start_page IS NULL OR segment_start_page >= 1);

NOTIFY pgrst, 'reload schema';
