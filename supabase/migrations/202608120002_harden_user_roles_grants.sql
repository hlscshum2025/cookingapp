-- RLS does not protect TRUNCATE and table-level grants can outlive policy intent.
-- Strip all client privileges first, then grant only the read capability needed
-- for a signed-in user to resolve their own role through the RLS policy.

revoke all privileges on table public.user_roles from anon, authenticated;
grant select on table public.user_roles to authenticated;
