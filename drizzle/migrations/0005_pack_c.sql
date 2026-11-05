ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE TABLE public.poll_votes (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  option_index integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.poll_votes TO authenticated;
GRANT ALL ON public.poll_votes TO service_role;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "see votes" ON public.poll_votes FOR SELECT TO authenticated
  USING (public.can_see_message(message_id, auth.uid()));
CREATE POLICY "vote own" ON public.poll_votes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_see_message(message_id, auth.uid()));
CREATE POLICY "change own vote" ON public.poll_votes FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "remove own vote" ON public.poll_votes FOR DELETE TO authenticated
  USING (user_id = auth.uid());
ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes;