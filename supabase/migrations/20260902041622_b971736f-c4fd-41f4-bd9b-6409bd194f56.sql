CREATE OR REPLACE FUNCTION public.are_friends(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.friendships WHERE user_id = _a AND friend_id = _b)
$$;
REVOKE ALL ON FUNCTION public.are_friends(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.are_friends(uuid, uuid) TO authenticated;

CREATE POLICY "read friend lists of my friends" ON public.friendships FOR SELECT TO authenticated
  USING (public.are_friends(auth.uid(), user_id));