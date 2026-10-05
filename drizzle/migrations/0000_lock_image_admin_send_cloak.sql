ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS lock_image_url text;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS cloak_url text;
CREATE POLICY "admins send messages anywhere" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admins add reactions anywhere" ON public.message_reactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'::app_role));