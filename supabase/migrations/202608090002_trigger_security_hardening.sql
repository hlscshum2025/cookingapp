-- Trigger helpers must only be invoked by their triggers, never through RPC.
-- Safe to rerun; trigger execution is not affected by revoking direct EXECUTE.

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.snapshot_recipe_update() from public, anon, authenticated;
