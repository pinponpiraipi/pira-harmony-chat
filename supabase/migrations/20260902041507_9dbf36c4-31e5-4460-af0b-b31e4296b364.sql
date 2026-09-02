CREATE POLICY "pira media readable by authenticated" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'pira-media');
CREATE POLICY "pira media upload own folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pira-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "pira media update own folder" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'pira-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "pira media delete own folder" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'pira-media' AND (storage.foldername(name))[1] = auth.uid()::text);