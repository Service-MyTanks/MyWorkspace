-- Create default account controls automatically for every newly registered profile.
create or replace function public.ensure_account_controls_for_profile()
returns trigger language plpgsql security definer set search_path = ''
as $function$
begin
  insert into public.account_controls(user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$function$;

revoke all on function public.ensure_account_controls_for_profile() from public, anon, authenticated;

drop trigger if exists ensure_account_controls_after_profile_insert on public.profiles;
create trigger ensure_account_controls_after_profile_insert
after insert on public.profiles
for each row execute function public.ensure_account_controls_for_profile();
