ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS calc_triggers jsonb NOT NULL DEFAULT '[{"code":"810","url":"","label":"PIRA"}]'::jsonb,
  ADD COLUMN IF NOT EXISTS max_coins_per_question integer NOT NULL DEFAULT 5;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS music_url text;

-- Site park
CREATE TABLE public.park_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  kind text NOT NULL DEFAULT 'url',
  url text,
  code text,
  name text NOT NULL,
  description text,
  icon_url text,
  icon_size integer NOT NULL DEFAULT 128,
  width integer NOT NULL DEFAULT 960,
  height integer NOT NULL DEFAULT 600,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.park_sites TO authenticated;
GRANT ALL ON public.park_sites TO service_role;
ALTER TABLE public.park_sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "park read" ON public.park_sites FOR SELECT TO authenticated USING (true);
CREATE POLICY "park insert" ON public.park_sites FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "park update" ON public.park_sites FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "park delete" ON public.park_sites FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- Study
CREATE TABLE public.study_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL,
  subject text NOT NULL DEFAULT 'その他',
  question text NOT NULL,
  choices jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_index integer NOT NULL DEFAULT 0,
  coins integer NOT NULL DEFAULT 1,
  fast_seconds integer NOT NULL DEFAULT 10,
  slow_coins integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_questions TO authenticated;
GRANT ALL ON public.study_questions TO service_role;
ALTER TABLE public.study_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sq read" ON public.study_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "sq insert" ON public.study_questions FOR INSERT TO authenticated WITH CHECK (creator_id = auth.uid());
CREATE POLICY "sq update" ON public.study_questions FOR UPDATE TO authenticated
  USING (creator_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "sq delete" ON public.study_questions FOR DELETE TO authenticated
  USING (creator_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.study_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.study_questions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  correct boolean NOT NULL,
  seconds numeric NOT NULL,
  coins integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (question_id, user_id)
);
GRANT SELECT ON public.study_attempts TO authenticated;
GRANT ALL ON public.study_attempts TO service_role;
ALTER TABLE public.study_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sa read own" ON public.study_attempts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- Coins capped by creator choice and admin max; correctness checked here, not in the browser.
CREATE OR REPLACE FUNCTION public.answer_question(_question_id uuid, _choice integer, _seconds numeric)
RETURNS TABLE(correct boolean, coins integer, correct_index integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE q public.study_questions; mx integer; ok boolean; c integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  SELECT * INTO q FROM public.study_questions WHERE id = _question_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'question not found'; END IF;
  IF EXISTS (SELECT 1 FROM public.study_attempts a WHERE a.question_id = _question_id AND a.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'already answered';
  END IF;
  SELECT COALESCE(max_coins_per_question, 5) INTO mx FROM public.app_settings WHERE id = true;
  mx := LEAST(COALESCE(mx,5), 5);
  ok := (_choice = q.correct_index);
  IF ok AND q.creator_id <> auth.uid() THEN
    IF _seconds <= q.fast_seconds THEN c := q.coins; ELSE c := q.slow_coins; END IF;
    c := GREATEST(0, LEAST(c, mx));
  END IF;
  INSERT INTO public.study_attempts(question_id, user_id, correct, seconds, coins)
    VALUES (_question_id, auth.uid(), ok, GREATEST(_seconds,0), c);
  RETURN QUERY SELECT ok, c, q.correct_index;
END $$;
GRANT EXECUTE ON FUNCTION public.answer_question(uuid, integer, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.coin_ranking(_period text)
RETURNS TABLE(user_id uuid, display_name text, avatar_url text, coins bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.user_id, p.display_name, p.avatar_url, SUM(a.coins)::bigint
  FROM public.study_attempts a JOIN public.profiles p ON p.id = a.user_id
  WHERE a.coins > 0 AND a.created_at >= CASE _period
      WHEN 'day' THEN date_trunc('day', now() AT TIME ZONE 'Asia/Tokyo') AT TIME ZONE 'Asia/Tokyo'
      WHEN 'month' THEN date_trunc('month', now() AT TIME ZONE 'Asia/Tokyo') AT TIME ZONE 'Asia/Tokyo'
      ELSE date_trunc('year', now() AT TIME ZONE 'Asia/Tokyo') AT TIME ZONE 'Asia/Tokyo' END
    AND NOT p.deleted
  GROUP BY a.user_id, p.display_name, p.avatar_url
  ORDER BY 4 DESC LIMIT 100
$$;
GRANT EXECUTE ON FUNCTION public.coin_ranking(text) TO authenticated;

-- Calendars
CREATE TABLE public.calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#10b981',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.calendar_members (
  calendar_id uuid NOT NULL REFERENCES public.calendars(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (calendar_id, user_id)
);
CREATE TABLE public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id uuid NOT NULL REFERENCES public.calendars(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL,
  day date NOT NULL,
  title text NOT NULL,
  time_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendars, public.calendar_members, public.calendar_events TO authenticated;
GRANT ALL ON public.calendars, public.calendar_members, public.calendar_events TO service_role;
ALTER TABLE public.calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_see_calendar(_cal uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.calendars c WHERE c.id = _cal AND c.owner_id = _user)
      OR EXISTS (SELECT 1 FROM public.calendar_members m WHERE m.calendar_id = _cal AND m.user_id = _user)
$$;
CREATE OR REPLACE FUNCTION public.calendar_owner(_cal uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT owner_id FROM public.calendars WHERE id = _cal
$$;

CREATE POLICY "cal read" ON public.calendars FOR SELECT TO authenticated USING (public.can_see_calendar(id, auth.uid()));
CREATE POLICY "cal insert" ON public.calendars FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "cal update" ON public.calendars FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "cal delete" ON public.calendars FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "calm read" ON public.calendar_members FOR SELECT TO authenticated USING (public.can_see_calendar(calendar_id, auth.uid()));
CREATE POLICY "calm insert" ON public.calendar_members FOR INSERT TO authenticated WITH CHECK (public.calendar_owner(calendar_id) = auth.uid());
CREATE POLICY "calm delete" ON public.calendar_members FOR DELETE TO authenticated
  USING (public.calendar_owner(calendar_id) = auth.uid() OR user_id = auth.uid());

CREATE POLICY "cale read" ON public.calendar_events FOR SELECT TO authenticated USING (public.can_see_calendar(calendar_id, auth.uid()));
CREATE POLICY "cale insert" ON public.calendar_events FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid() AND public.can_see_calendar(calendar_id, auth.uid()) AND day BETWEEN '2026-01-01' AND '2028-12-31');
CREATE POLICY "cale delete" ON public.calendar_events FOR DELETE TO authenticated
  USING (creator_id = auth.uid() OR public.calendar_owner(calendar_id) = auth.uid());