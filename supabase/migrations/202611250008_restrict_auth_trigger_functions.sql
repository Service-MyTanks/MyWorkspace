-- Trigger functions are only invoked by their Auth table triggers, never directly through PostgREST.
revoke all on function public.protect_reserved_support_email() from public, anon, authenticated;
revoke all on function public.sync_profile_email() from public, anon, authenticated;
