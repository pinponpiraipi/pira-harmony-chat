ALTER TABLE public.notification_settings ADD COLUMN IF NOT EXISTS tones jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE public.call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  caller_id uuid NOT NULL,
  mode text NOT NULL DEFAULT 'audio',
  status text NOT NULL DEFAULT 'missed',
  answered_at timestamptz,
  ended_at timestamptz,
  duration_sec integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.call_logs TO authenticated;
GRANT ALL ON public.call_logs TO service_role;
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read call logs" ON public.call_logs FOR SELECT TO authenticated
  USING (public.is_member(conversation_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "caller creates call logs" ON public.call_logs FOR INSERT TO authenticated
  WITH CHECK (caller_id = auth.uid() AND public.is_member(conversation_id, auth.uid()));
CREATE POLICY "members update call logs" ON public.call_logs FOR UPDATE TO authenticated
  USING (public.is_member(conversation_id, auth.uid())) WITH CHECK (public.is_member(conversation_id, auth.uid()));
CREATE INDEX call_logs_conv_idx ON public.call_logs (conversation_id, created_at DESC);

CREATE TABLE public.call_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  title text NOT NULL DEFAULT '通話の記録',
  transcript text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  consent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_transcripts TO authenticated;
GRANT ALL ON public.call_transcripts TO service_role;
ALTER TABLE public.call_transcripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own transcripts" ON public.call_transcripts FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid() AND consent);