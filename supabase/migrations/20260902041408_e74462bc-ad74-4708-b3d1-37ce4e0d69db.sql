REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE ALL ON FUNCTION public.is_member(uuid, uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.conversation_owner(uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.can_see_message(uuid, uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.grant_owner_admin() FROM anon, authenticated, public;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.conversation_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_see_message(uuid, uuid) TO authenticated;