-- Lithium v1.10: agenda and scheduled reviews after Active Recall completion.
CREATE TABLE IF NOT EXISTS public.scheduled_reviews (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone_summary_id UUID NOT NULL REFERENCES public.milestone_summaries(id) ON DELETE CASCADE,
  review_date          DATE NOT NULL,
  review_type          TEXT NOT NULL CHECK (review_type IN ('D+1', 'D+7', 'D+21')),
  status               TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'completed', 'missed')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_scheduled_reviews_user_summary_type
  ON public.scheduled_reviews (user_id, milestone_summary_id, review_type);
CREATE INDEX IF NOT EXISTS idx_scheduled_reviews_user_date
  ON public.scheduled_reviews (user_id, review_date, status);

ALTER TABLE public.scheduled_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.scheduled_reviews FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.scheduled_reviews TO authenticated;

DROP POLICY IF EXISTS "Users manage own scheduled reviews" ON public.scheduled_reviews;
CREATE POLICY "Users manage own scheduled reviews"
  ON public.scheduled_reviews
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP TRIGGER IF EXISTS scheduled_reviews_updated_at ON public.scheduled_reviews;
CREATE TRIGGER scheduled_reviews_updated_at
  BEFORE UPDATE ON public.scheduled_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

CREATE OR REPLACE FUNCTION public.complete_milestone_summary(
  p_summary_id UUID,
  p_content TEXT,
  p_completed_date DATE,
  p_review_date_1 DATE,
  p_review_date_7 DATE,
  p_review_date_21 DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_content IS NULL OR length(btrim(p_content)) = 0 THEN
    RAISE EXCEPTION 'Summary content is required';
  END IF;
  IF p_review_date_1 <> p_completed_date + 1
    OR p_review_date_7 <> p_completed_date + 7
    OR p_review_date_21 <> p_completed_date + 21 THEN
    RAISE EXCEPTION 'Invalid scheduled review dates';
  END IF;

  UPDATE public.milestone_summaries
     SET content = btrim(p_content), status = 'completed'
   WHERE id = p_summary_id
     AND user_id = auth.uid()
     AND status = 'review';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Milestone summary is unavailable or not in review';
  END IF;

  INSERT INTO public.scheduled_reviews
    (user_id, milestone_summary_id, review_date, review_type)
  VALUES
    (auth.uid(), p_summary_id, p_review_date_1, 'D+1'),
    (auth.uid(), p_summary_id, p_review_date_7, 'D+7'),
    (auth.uid(), p_summary_id, p_review_date_21, 'D+21')
  ON CONFLICT (user_id, milestone_summary_id, review_type) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_milestone_summary(UUID, TEXT, DATE, DATE, DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_milestone_summary(UUID, TEXT, DATE, DATE, DATE, DATE) TO authenticated;

NOTIFY pgrst, 'reload schema';
