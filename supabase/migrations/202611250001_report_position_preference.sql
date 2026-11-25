-- MT MyWorkspace: per-account report position selection preference.
begin;
alter table public.profiles
  add column if not exists manual_report_position boolean not null default false;
create or replace function public.set_own_manual_report_position(enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Требуется авторизация' using errcode = '42501';
  end if;
  update public.profiles
  set manual_report_position = coalesce(enabled, false)
  where id = auth.uid();
  if not found then
    raise exception 'Профиль не найден' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.set_own_manual_report_position(boolean) from public, anon, authenticated;
grant execute on function public.set_own_manual_report_position(boolean) to authenticated;
commit;
