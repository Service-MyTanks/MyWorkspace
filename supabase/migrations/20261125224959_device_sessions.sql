-- Prevent concurrent account use from the same browser installation.
create table if not exists public.device_sessions (
  device_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  ip_address text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists device_sessions_user_id_idx on public.device_sessions(user_id);
alter table public.device_sessions enable row level security;
revoke all on public.device_sessions from public, anon, authenticated;

create or replace function public.claim_device_session(p_device_id uuid, p_ip_address text default null)
returns boolean language plpgsql security definer set search_path = ''
as $function$
declare v_claimed boolean := false;
begin
  if auth.uid() is null then raise exception 'Требуется авторизация' using errcode = '42501'; end if;
  if p_device_id is null then raise exception 'Не указан идентификатор устройства' using errcode = '22023'; end if;
  insert into public.device_sessions(device_id, user_id, ip_address, created_at, last_seen_at)
  values (p_device_id, auth.uid(), nullif(left(coalesce(p_ip_address, ''), 64), ''), now(), now())
  on conflict (device_id) do update
    set user_id = excluded.user_id,
        ip_address = coalesce(excluded.ip_address, public.device_sessions.ip_address),
        last_seen_at = now()
    where public.device_sessions.user_id = auth.uid()
       or public.device_sessions.last_seen_at < now() - interval '5 minutes'
  returning true into v_claimed;
  return coalesce(v_claimed, false);
end;
$function$;

create or replace function public.heartbeat_device_session(p_device_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $function$
declare v_updated boolean := false;
begin
  if auth.uid() is null then raise exception 'Требуется авторизация' using errcode = '42501'; end if;
  update public.device_sessions set last_seen_at = now()
    where device_id = p_device_id and user_id = auth.uid()
    returning true into v_updated;
  return coalesce(v_updated, false);
end;
$function$;

create or replace function public.release_device_session(p_device_id uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
begin
  if auth.uid() is null then raise exception 'Требуется авторизация' using errcode = '42501'; end if;
  delete from public.device_sessions where device_id = p_device_id and user_id = auth.uid();
end;
$function$;

revoke all on function public.claim_device_session(uuid, text) from public, anon;
revoke all on function public.heartbeat_device_session(uuid) from public, anon;
revoke all on function public.release_device_session(uuid) from public, anon;
grant execute on function public.claim_device_session(uuid, text) to authenticated;
grant execute on function public.heartbeat_device_session(uuid) to authenticated;
grant execute on function public.release_device_session(uuid) to authenticated;
