-- Lithium v1.13: qualify the reading speed column in the atomic session RPC.

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

  SELECT r.id, r.milestones, r.target_pages, r.segment_start_page, r.type,
         r.current_speed_pph
    INTO v_reading
    FROM public.readings AS r
   WHERE r.id = p_reading_id
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

NOTIFY pgrst, 'reload schema';
