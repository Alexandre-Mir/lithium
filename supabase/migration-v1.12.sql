-- Lithium v1.12: owner-only RLS, preserved foreign-key history,
-- idempotent session creation and atomic reading completion.

ALTER TABLE public.reading_sessions
  ADD COLUMN IF NOT EXISTS request_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS uq_reading_sessions_request_id
  ON public.reading_sessions (request_id)
  WHERE request_id IS NOT NULL;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

INSERT INTO public.app_settings (id, daily_goal_minutes)
VALUES (1, 60)
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  v_owner_id UUID;
  v_owner_count INTEGER;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.app_settings WHERE id = 1 AND owner_id IS NOT NULL
  ) THEN
    RETURN;
  END IF;

  SELECT COUNT(*)::INTEGER
    INTO v_owner_count
    FROM auth.users;

  IF v_owner_count <> 1 THEN
    RAISE EXCEPTION
      'Lithium v1.12 requires exactly one existing auth.users account to assign ownership; configure app_settings.owner_id explicitly before retrying.';
  END IF;

  SELECT id INTO v_owner_id FROM auth.users LIMIT 1;
  UPDATE public.app_settings
     SET owner_id = v_owner_id
   WHERE id = 1;
END;
$$;

ALTER TABLE public.app_settings
  ALTER COLUMN owner_id SET NOT NULL;

-- Retain historical data: deleting a parent must be blocked while it has children.
ALTER TABLE public.deliverables
  DROP CONSTRAINT IF EXISTS deliverables_subject_id_fkey,
  ADD CONSTRAINT deliverables_subject_id_fkey
    FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE RESTRICT;
ALTER TABLE public.readings
  DROP CONSTRAINT IF EXISTS readings_subject_id_fkey,
  ADD CONSTRAINT readings_subject_id_fkey
    FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE RESTRICT;
ALTER TABLE public.reading_sessions
  DROP CONSTRAINT IF EXISTS reading_sessions_reading_id_fkey,
  ADD CONSTRAINT reading_sessions_reading_id_fkey
    FOREIGN KEY (reading_id) REFERENCES public.readings(id) ON DELETE RESTRICT;
ALTER TABLE public.spaced_reviews
  DROP CONSTRAINT IF EXISTS spaced_reviews_reading_id_fkey,
  ADD CONSTRAINT spaced_reviews_reading_id_fkey
    FOREIGN KEY (reading_id) REFERENCES public.readings(id) ON DELETE RESTRICT;
ALTER TABLE public.milestone_summaries
  DROP CONSTRAINT IF EXISTS milestone_summaries_book_id_fkey,
  ADD CONSTRAINT milestone_summaries_book_id_fkey
    FOREIGN KEY (book_id) REFERENCES public.readings(id) ON DELETE RESTRICT;
ALTER TABLE public.scheduled_reviews
  DROP CONSTRAINT IF EXISTS scheduled_reviews_milestone_summary_id_fkey,
  ADD CONSTRAINT scheduled_reviews_milestone_summary_id_fkey
    FOREIGN KEY (milestone_summary_id) REFERENCES public.milestone_summaries(id) ON DELETE RESTRICT;

-- Protect reading goals from being reduced below progress already recorded.
CREATE OR REPLACE FUNCTION public.prevent_reading_target_below_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_pages_read BIGINT;
BEGIN
  IF NEW.target_pages < OLD.target_pages THEN
    SELECT COALESCE(SUM(pages_read), 0)
      INTO v_pages_read
      FROM public.reading_sessions
     WHERE reading_id = NEW.id;

    IF NEW.target_pages < v_pages_read THEN
      RAISE EXCEPTION 'Reading target cannot be below pages already read (% pages).', v_pages_read
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS readings_target_progress_check ON public.readings;
CREATE TRIGGER readings_target_progress_check
  BEFORE UPDATE OF target_pages ON public.readings
  FOR EACH ROW EXECUTE FUNCTION public.prevent_reading_target_below_progress();

CREATE OR REPLACE FUNCTION public.lithium_initial_reading_speed(p_type public.reading_type)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH totals AS (
    SELECT
      COALESCE(SUM(sessions), 0)::BIGINT AS sessions,
      COALESCE(SUM(total_pages), 0)::BIGINT AS pages,
      COALESCE(SUM(total_seconds), 0)::BIGINT AS seconds
    FROM public.reading_speed_stats
  ),
  type_totals AS (
    SELECT
      COALESCE(SUM(sessions), 0)::BIGINT AS sessions,
      COALESCE(SUM(total_pages), 0)::BIGINT AS pages,
      COALESCE(SUM(total_seconds), 0)::BIGINT AS seconds
    FROM public.reading_speed_stats
    WHERE reading_type = p_type::TEXT
  )
  SELECT CASE
    WHEN type_totals.sessions >= 3 AND type_totals.seconds >= 2700
      THEN ROUND(type_totals.pages * 3600.0 / type_totals.seconds, 1)
    WHEN totals.sessions >= 3 AND totals.seconds >= 2700
      THEN ROUND(totals.pages * 3600.0 / totals.seconds, 1)
    ELSE 20
  END
  FROM totals, type_totals;
$$;

CREATE OR REPLACE FUNCTION public.create_reading_session_atomic(
  p_request_id UUID,
  p_reading_id UUID,
  p_pages_read INTEGER,
  p_duration_seconds INTEGER,
  p_started_at TIMESTAMPTZ,
  p_ended_at TIMESTAMPTZ,
  p_source TEXT
)
RETURNS TABLE(session_id UUID, current_speed_pph NUMERIC, inserted BOOLEAN)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_reading RECORD;
  v_progress RECORD;
  v_session public.reading_sessions%ROWTYPE;
  v_speed NUMERIC;
  v_inserted BOOLEAN := FALSE;
  v_previous_page INTEGER := 0;
  v_next_page INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_request_id IS NULL OR p_pages_read < 1
    OR p_duration_seconds < 1 OR p_duration_seconds > 43200
    OR p_source NOT IN ('manual', 'timer', 'timer_adjusted') THEN
    RAISE EXCEPTION 'Invalid reading session';
  END IF;
  IF p_started_at IS NOT NULL AND p_ended_at IS NOT NULL AND p_ended_at < p_started_at THEN
    RAISE EXCEPTION 'Session end cannot be earlier than its start';
  END IF;

  SELECT id, milestones, target_pages, segment_start_page, type, current_speed_pph
    INTO v_reading
    FROM public.readings
   WHERE id = p_reading_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reading not found';
  END IF;

  INSERT INTO public.reading_sessions
    (request_id, reading_id, pages_read, duration_seconds, duration_minutes,
     started_at, ended_at, source)
  VALUES
    (p_request_id, p_reading_id, p_pages_read, p_duration_seconds,
     GREATEST(1, ROUND(p_duration_seconds / 60.0)::INTEGER),
     p_started_at, p_ended_at, p_source)
  ON CONFLICT (request_id) WHERE request_id IS NOT NULL DO NOTHING
  RETURNING * INTO v_session;

  v_inserted := FOUND;
  IF NOT v_inserted THEN
    SELECT * INTO v_session
      FROM public.reading_sessions
     WHERE request_id = p_request_id;
    IF NOT FOUND OR v_session.reading_id <> p_reading_id
      OR v_session.pages_read <> p_pages_read
      OR v_session.duration_seconds <> p_duration_seconds
      OR v_session.started_at IS DISTINCT FROM p_started_at
      OR v_session.ended_at IS DISTINCT FROM p_ended_at
      OR v_session.source <> p_source THEN
      RAISE EXCEPTION 'Session request id was already used for a different request';
    END IF;
    RETURN QUERY SELECT v_session.id, v_reading.current_speed_pph, FALSE;
    RETURN;
  END IF;

  SELECT COALESCE(pages_read, 0)::INTEGER INTO v_previous_page
    FROM public.reading_progress
   WHERE reading_id = p_reading_id;
  v_previous_page := COALESCE(v_previous_page, 0);
  v_next_page := v_previous_page + p_pages_read;

  WITH raw_milestones AS (
    SELECT
      NULLIF(BTRIM(item->>'title'), '') AS title,
      CASE
        WHEN item->>'page' ~ '^[0-9]+$' THEN (item->>'page')::INTEGER
        ELSE NULL
      END AS original_page
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(v_reading.milestones, '[]'::JSONB)) AS item
  ),
  valid_milestones AS (
    SELECT title, original_page
      FROM raw_milestones
     WHERE title IS NOT NULL AND original_page > 0
  ),
  prior_milestone AS (
    SELECT title, original_page
      FROM valid_milestones
     WHERE v_reading.segment_start_page IS NOT NULL
       AND original_page < v_reading.segment_start_page
     ORDER BY original_page DESC
     LIMIT 1
  ),
  normalized AS (
    SELECT title, original_page,
           CASE WHEN v_reading.segment_start_page IS NULL
             THEN original_page
             ELSE original_page - v_reading.segment_start_page
           END AS effective_page
      FROM valid_milestones
     WHERE v_reading.segment_start_page IS NULL
        OR (original_page >= v_reading.segment_start_page
            AND original_page <= v_reading.segment_start_page + v_reading.target_pages)
    UNION ALL
    SELECT title, original_page, 0
      FROM prior_milestone
  ),
  ordered AS (
    SELECT *,
           ROW_NUMBER() OVER (ORDER BY effective_page, original_page) AS milestone_order,
           COUNT(*) OVER () AS milestone_count,
           LAG(title) OVER (ORDER BY effective_page, original_page) AS prior_title,
           LAG(original_page) OVER (ORDER BY effective_page, original_page) AS prior_page
      FROM normalized
  ),
  crossed AS (
    SELECT prior_title AS title, prior_page AS page
      FROM ordered
     WHERE milestone_order > 1
       AND effective_page > v_previous_page
       AND effective_page <= v_next_page
    UNION
    SELECT title, original_page
      FROM ordered
     WHERE v_next_page >= v_reading.target_pages
       AND milestone_order = milestone_count
  )
  INSERT INTO public.milestone_summaries
    (user_id, book_id, milestone_title, milestone_page, content, status)
  SELECT auth.uid(), p_reading_id, title, page, NULL, 'pending'
    FROM crossed
   WHERE title IS NOT NULL AND page IS NOT NULL
  ON CONFLICT (user_id, book_id, milestone_page, milestone_title) DO NOTHING;

  SELECT sessions, pages_read, total_seconds
    INTO v_progress
    FROM public.reading_progress
   WHERE reading_id = p_reading_id;
  IF COALESCE(v_progress.sessions, 0) > 0
    AND COALESCE(v_progress.pages_read, 0) > 0
    AND COALESCE(v_progress.total_seconds, 0) > 0 THEN
    v_speed := ROUND(v_progress.pages_read * 3600.0 / v_progress.total_seconds, 2);
  ELSE
    v_speed := public.lithium_initial_reading_speed(v_reading.type);
  END IF;

  UPDATE public.readings
     SET current_speed_pph = v_speed
   WHERE id = p_reading_id;

  RETURN QUERY SELECT v_session.id, v_speed, TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_reading_session_atomic(
  p_session_id UUID,
  p_pages_read INTEGER,
  p_duration_seconds INTEGER,
  p_source TEXT
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_session public.reading_sessions%ROWTYPE;
  v_reading_id UUID;
  v_reading_type public.reading_type;
  v_progress RECORD;
  v_speed NUMERIC;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_pages_read < 1 OR p_duration_seconds < 1 OR p_duration_seconds > 43200
    OR p_source NOT IN ('manual', 'timer', 'timer_adjusted') THEN
    RAISE EXCEPTION 'Invalid reading session';
  END IF;

  SELECT reading_id INTO v_reading_id
    FROM public.reading_sessions
   WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;

  SELECT type INTO v_reading_type
    FROM public.readings
   WHERE id = v_reading_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reading not found'; END IF;

  SELECT * INTO v_session
    FROM public.reading_sessions
   WHERE id = p_session_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;

  UPDATE public.reading_sessions
     SET pages_read = p_pages_read,
         duration_seconds = p_duration_seconds,
         duration_minutes = GREATEST(1, ROUND(p_duration_seconds / 60.0)::INTEGER),
         source = p_source
   WHERE id = p_session_id;

  SELECT sessions, pages_read, total_seconds
    INTO v_progress
    FROM public.reading_progress
   WHERE reading_id = v_session.reading_id;

  IF COALESCE(v_progress.sessions, 0) > 0
    AND COALESCE(v_progress.pages_read, 0) > 0
    AND COALESCE(v_progress.total_seconds, 0) > 0 THEN
    v_speed := ROUND(v_progress.pages_read * 3600.0 / v_progress.total_seconds, 2);
  ELSE
    v_speed := public.lithium_initial_reading_speed(v_reading_type);
  END IF;
  UPDATE public.readings SET current_speed_pph = v_speed WHERE id = v_session.reading_id;
  RETURN v_speed;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_reading_session_atomic(p_session_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_reading_type public.reading_type;
  v_reading_id UUID;
  v_progress RECORD;
  v_speed NUMERIC;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT reading_id INTO v_reading_id
    FROM public.reading_sessions
   WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;

  SELECT type INTO v_reading_type
    FROM public.readings
   WHERE id = v_reading_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reading not found'; END IF;

  PERFORM 1
    FROM public.reading_sessions
   WHERE id = p_session_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;

  DELETE FROM public.reading_sessions WHERE id = p_session_id;
  SELECT sessions, pages_read, total_seconds
    INTO v_progress
    FROM public.reading_progress
   WHERE reading_id = v_reading_id;

  IF COALESCE(v_progress.sessions, 0) > 0
    AND COALESCE(v_progress.pages_read, 0) > 0
    AND COALESCE(v_progress.total_seconds, 0) > 0 THEN
    v_speed := ROUND(v_progress.pages_read * 3600.0 / v_progress.total_seconds, 2);
  ELSE
    v_speed := public.lithium_initial_reading_speed(v_reading_type);
  END IF;
  UPDATE public.readings SET current_speed_pph = v_speed WHERE id = v_reading_id;
  RETURN v_speed;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_reading_completion_atomic(
  p_reading_id UUID,
  p_is_read BOOLEAN,
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
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_is_read AND (
    p_review_date_1 IS NULL OR p_review_date_7 IS NULL OR p_review_date_21 IS NULL
    OR p_review_date_7 <> p_review_date_1 + 6
    OR p_review_date_21 <> p_review_date_1 + 20
  ) THEN
    RAISE EXCEPTION 'Invalid spaced review schedule';
  END IF;

  UPDATE public.readings SET is_read = p_is_read WHERE id = p_reading_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reading not found'; END IF;

  IF p_is_read THEN
    INSERT INTO public.spaced_reviews (reading_id, review_date, status, type)
    VALUES
      (p_reading_id, p_review_date_1, 'pending', 'active_recall'),
      (p_reading_id, p_review_date_7, 'pending', 'active_recall'),
      (p_reading_id, p_review_date_21, 'pending', 'active_recall')
    ON CONFLICT (reading_id, review_date, type) DO NOTHING;
  ELSE
    DELETE FROM public.spaced_reviews WHERE reading_id = p_reading_id;
  END IF;
END;
$$;

-- Lock core tables to the single existing account and its owned rows.
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spaced_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestone_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all" ON public.subjects;
DROP POLICY IF EXISTS "Allow all" ON public.deliverables;
DROP POLICY IF EXISTS "Allow all" ON public.readings;
DROP POLICY IF EXISTS "Allow all" ON public.reading_sessions;
DROP POLICY IF EXISTS "Allow all" ON public.spaced_reviews;
DROP POLICY IF EXISTS "Allow all" ON public.app_settings;
DROP POLICY IF EXISTS "Owner manages subjects" ON public.subjects;
DROP POLICY IF EXISTS "Owner manages deliverables" ON public.deliverables;
DROP POLICY IF EXISTS "Owner manages readings" ON public.readings;
DROP POLICY IF EXISTS "Owner manages reading sessions" ON public.reading_sessions;
DROP POLICY IF EXISTS "Owner manages spaced reviews" ON public.spaced_reviews;
DROP POLICY IF EXISTS "Owner manages app settings" ON public.app_settings;

CREATE POLICY "Owner manages subjects"
  ON public.subjects FOR ALL TO authenticated
  USING (auth.uid() = (SELECT owner_id FROM public.app_settings WHERE id = 1))
  WITH CHECK (auth.uid() = (SELECT owner_id FROM public.app_settings WHERE id = 1));
CREATE POLICY "Owner manages deliverables"
  ON public.deliverables FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.subjects s WHERE s.id = subject_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.subjects s WHERE s.id = subject_id));
CREATE POLICY "Owner manages readings"
  ON public.readings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.subjects s WHERE s.id = subject_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.subjects s WHERE s.id = subject_id));
CREATE POLICY "Owner manages reading sessions"
  ON public.reading_sessions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.readings r WHERE r.id = reading_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.readings r WHERE r.id = reading_id));
CREATE POLICY "Owner manages spaced reviews"
  ON public.spaced_reviews FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.readings r WHERE r.id = reading_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.readings r WHERE r.id = reading_id));
CREATE POLICY "Owner manages app settings"
  ON public.app_settings FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Allow all" ON public.milestone_summaries;
DROP POLICY IF EXISTS "Users manage own milestone summaries" ON public.milestone_summaries;
DROP POLICY IF EXISTS "Owner manages own milestone summaries" ON public.milestone_summaries;
CREATE POLICY "Owner manages own milestone summaries"
  ON public.milestone_summaries FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.readings r WHERE r.id = book_id)
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.readings r WHERE r.id = book_id)
  );

DROP POLICY IF EXISTS "Users manage own scheduled reviews" ON public.scheduled_reviews;
DROP POLICY IF EXISTS "Owner manages own scheduled reviews" ON public.scheduled_reviews;
CREATE POLICY "Owner manages own scheduled reviews"
  ON public.scheduled_reviews FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.milestone_summaries m
       WHERE m.id = milestone_summary_id AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.milestone_summaries m
       WHERE m.id = milestone_summary_id AND m.user_id = auth.uid()
    )
  );

REVOKE ALL ON TABLE public.subjects, public.deliverables, public.readings,
  public.reading_sessions, public.spaced_reviews, public.app_settings,
  public.milestone_summaries, public.scheduled_reviews FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.subjects, public.deliverables,
  public.readings, public.reading_sessions, public.spaced_reviews, public.app_settings,
  public.milestone_summaries, public.scheduled_reviews TO authenticated;

REVOKE ALL ON public.reading_progress, public.reading_speed_stats FROM anon;
GRANT SELECT ON public.reading_progress, public.reading_speed_stats TO authenticated;

REVOKE ALL ON FUNCTION public.lithium_initial_reading_speed(public.reading_type) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_reading_session_atomic(UUID, UUID, INTEGER, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_reading_session_atomic(UUID, INTEGER, INTEGER, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_reading_session_atomic(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_reading_completion_atomic(UUID, BOOLEAN, DATE, DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lithium_initial_reading_speed(public.reading_type) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_reading_session_atomic(UUID, UUID, INTEGER, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_reading_session_atomic(UUID, INTEGER, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_reading_session_atomic(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_reading_completion_atomic(UUID, BOOLEAN, DATE, DATE, DATE) TO authenticated;

NOTIFY pgrst, 'reload schema';
