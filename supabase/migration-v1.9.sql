-- Lithium v1.9: resumos de Revisão Ativa por marco do livro.
CREATE TABLE IF NOT EXISTS public.milestone_summaries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id         UUID NOT NULL REFERENCES public.readings(id) ON DELETE CASCADE,
  milestone_title TEXT NOT NULL,
  milestone_page  INTEGER NOT NULL CHECK (milestone_page >= 1),
  content         TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'review', 'completed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_milestone_summaries_user_book_milestone
  ON public.milestone_summaries (user_id, book_id, milestone_page, milestone_title);
CREATE INDEX IF NOT EXISTS idx_milestone_summaries_user_status
  ON public.milestone_summaries (user_id, status, created_at DESC);

ALTER TABLE public.milestone_summaries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.milestone_summaries FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.milestone_summaries TO authenticated;

DROP POLICY IF EXISTS "Users manage own milestone summaries" ON public.milestone_summaries;
CREATE POLICY "Users manage own milestone summaries"
  ON public.milestone_summaries
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP TRIGGER IF EXISTS milestone_summaries_updated_at ON public.milestone_summaries;
CREATE TRIGGER milestone_summaries_updated_at
  BEFORE UPDATE ON public.milestone_summaries
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

NOTIFY pgrst, 'reload schema';
