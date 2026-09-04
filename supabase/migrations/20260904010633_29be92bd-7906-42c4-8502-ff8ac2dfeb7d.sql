-- Stickers
CREATE TABLE public.stickers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  pack TEXT NOT NULL DEFAULT 'マイスタンプ',
  name TEXT NOT NULL DEFAULT '',
  media_url TEXT NOT NULL,
  shared BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stickers TO authenticated;
GRANT ALL ON public.stickers TO service_role;
ALTER TABLE public.stickers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read shared or own stickers" ON public.stickers FOR SELECT TO authenticated
  USING (shared OR owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "insert own stickers" ON public.stickers FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "update own stickers" ON public.stickers FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "delete own stickers" ON public.stickers FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Custom themes
CREATE TABLE public.custom_themes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  vars JSONB NOT NULL DEFAULT '{}'::jsonb,
  shared BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_themes TO authenticated;
GRANT ALL ON public.custom_themes TO service_role;
ALTER TABLE public.custom_themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read shared or own themes" ON public.custom_themes FOR SELECT TO authenticated
  USING (shared OR owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "insert own themes" ON public.custom_themes FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "update own themes" ON public.custom_themes FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "delete own themes" ON public.custom_themes FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Notification preferences
CREATE TABLE public.notification_settings (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  sound TEXT NOT NULL DEFAULT 'pop',
  volume NUMERIC NOT NULL DEFAULT 0.6,
  desktop BOOLEAN NOT NULL DEFAULT true,
  quiet_hours JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_settings TO authenticated;
GRANT ALL ON public.notification_settings TO service_role;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage own notification settings" ON public.notification_settings FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Birthday cards sent this year (one balloon per friend per year)
CREATE TABLE public.birthday_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  year INT NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sender_id, recipient_id, year)
);
GRANT SELECT, INSERT, DELETE ON public.birthday_cards TO authenticated;
GRANT ALL ON public.birthday_cards TO service_role;
ALTER TABLE public.birthday_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read cards involving self" ON public.birthday_cards FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR recipient_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "send own cards" ON public.birthday_cards FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());
CREATE POLICY "delete own cards" ON public.birthday_cards FOR DELETE TO authenticated
  USING (sender_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Admin oversight: read every conversation and message, moderate profiles
CREATE POLICY "admins read all conversations" ON public.conversations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins read all members" ON public.conversation_members FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins read all messages" ON public.messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete messages" ON public.messages FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update messages" ON public.messages FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));