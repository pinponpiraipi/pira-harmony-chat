ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS screen_locked boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS notifications_off boolean NOT NULL DEFAULT false;
INSERT INTO public.app_settings (id) VALUES (true) ON CONFLICT DO NOTHING;
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;