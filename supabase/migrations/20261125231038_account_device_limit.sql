-- Enforce one active device per account by default, with an admin-controlled second slot.
alter table public.account_controls
  add column if not exists can_use_additional_device boolean not null default false;

create or replace function public.claim_device_session(p_device_id uuid, p_ip_address text default null)
returns boolean language plpgsql security definer set search_path = ''
as $function$
declare
  v_limit integer := 1;
  v_active_count integer := 0;
  v_inserted integer := 0;
begin
  if auth.uid() is null then raise exception 'Требуется авторизация' using errcode = '42501'; end if;
  if p_device_id is null then raise exception 'Не указан идентификатор устройства' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  delete from public.device_sessions where user_id = auth.uid() and last_seen_at < now() - interval '5 minutes';

  if exists (select 1 from public.device_sessions where device_id = p_device_id and user_id <> auth.uid() and last_seen_at >= now() - interval '5 minutes') then
    return false;
  end if;
  delete from public.device_sessions where device_id = p_device_id and user_id <> auth.uid() and last_seen_at < now() - interval '5 minutes';

  if exists (select 1 from public.device_sessions where device_id = p_device_id and user_id = auth.uid()) then
    update public.device_sessions
    set ip_address = coalesce(nullif(left(coalesce(p_ip_address, ''), 64), ''), ip_address), last_seen_at = now()
    where device_id = p_device_id and user_id = auth.uid();
    return true;
  end if;

  select case when coalesce(c.can_use_additional_device, false) then 2 else 1 end
    into v_limit from public.account_controls c where c.user_id = auth.uid();
  v_limit := coalesce(v_limit, 1);

  select count(*)::integer into v_active_count from public.device_sessions
  where user_id = auth.uid() and last_seen_at >= now() - interval '5 minutes';

  if v_active_count >= v_limit then
    delete from public.device_sessions
    where device_id in (
      select device_id from public.device_sessions
      where user_id = auth.uid() and last_seen_at >= now() - interval '5 minutes'
      order by created_at asc, last_seen_at asc, device_id
      limit (v_active_count - v_limit + 1)
    );
  end if;

  insert into public.device_sessions(device_id, user_id, ip_address, created_at, last_seen_at)
  values (p_device_id, auth.uid(), nullif(left(coalesce(p_ip_address, ''), 64), ''), now(), now())
  on conflict (device_id) do nothing;
  get diagnostics v_inserted = row_count;
  return v_inserted = 1;
end;
$function$;

create or replace function public.heartbeat_device_session(p_device_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $function$
declare v_updated boolean := false;
begin
  if auth.uid() is null then raise exception 'Требуется авторизация' using errcode = '42501'; end if;
  update public.device_sessions set last_seen_at = now()
  where device_id = p_device_id and user_id = auth.uid() and last_seen_at >= now() - interval '5 minutes'
  returning true into v_updated;
  return coalesce(v_updated, false);
end;
$function$;

create or replace function public.admin_update_account_controls(
  p_target uuid, p_settings jsonb, p_is_manager boolean,
  p_suspension_hours integer default null, p_suspension_reason text default null
)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_themes text[];
  v_old jsonb;
  v_new jsonb;
  v_reason text := btrim(coalesce(p_suspension_reason, ''));
  v_additional_device boolean := coalesce((p_settings->>'can_use_additional_device')::boolean, false);
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Недостаточно прав' using errcode = '42501'; end if;
  if p_target is null or p_target = auth.uid() then raise exception 'Нельзя изменять собственные административные полномочия и ограничения' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = p_target) then raise exception 'Аккаунт не найден' using errcode = 'P0002'; end if;
  if p_suspension_hours is not null and (p_suspension_hours < 1 or p_suspension_hours > 168) then raise exception 'Срок отстранения должен составлять от 1 до 168 часов' using errcode = '22023'; end if;
  if p_suspension_hours is not null and char_length(v_reason) < 5 then raise exception 'Укажите причину отстранения (не менее 5 символов)' using errcode = '22023'; end if;
  if jsonb_typeof(p_settings->'allowed_themes') <> 'array' then raise exception 'Не передан список разрешённых тем' using errcode = '22023'; end if;
  select coalesce(array_agg(value), array[]::text[]) into v_themes from jsonb_array_elements_text(p_settings->'allowed_themes') as t(value);
  if exists (select 1 from unnest(v_themes) x where x <> all(array['mt-standard','graphite','midnight','emerald','cherry','snow','violet']::text[])) then
    raise exception 'Список содержит неизвестную тему' using errcode = '22023';
  end if;
  select to_jsonb(c) into v_old from public.account_controls c where c.user_id = p_target;

  insert into public.account_controls (
    user_id, allowed_themes, preferred_theme, can_change_nickname, can_change_email,
    can_upload_avatar, can_access_training, can_use_additional_device,
    suspended_until, suspension_reason, suspended_by, updated_at, updated_by
  ) values (
    p_target, v_themes, case when cardinality(v_themes) > 0 then v_themes[1] else 'mt-standard' end,
    coalesce((p_settings->>'can_change_nickname')::boolean, true),
    coalesce((p_settings->>'can_change_email')::boolean, true),
    coalesce((p_settings->>'can_upload_avatar')::boolean, true),
    coalesce((p_settings->>'can_access_training')::boolean, true),
    v_additional_device,
    case when p_suspension_hours is null then null else now() + make_interval(hours => p_suspension_hours) end,
    case when p_suspension_hours is null then null else v_reason end,
    case when p_suspension_hours is null then null else auth.uid() end, now(), auth.uid()
  )
  on conflict (user_id) do update set
    allowed_themes = excluded.allowed_themes,
    preferred_theme = case when public.account_controls.preferred_theme = any(v_themes) then public.account_controls.preferred_theme when cardinality(v_themes) > 0 then v_themes[1] else 'mt-standard' end,
    can_change_nickname = excluded.can_change_nickname,
    can_change_email = excluded.can_change_email,
    can_upload_avatar = excluded.can_upload_avatar,
    can_access_training = excluded.can_access_training,
    can_use_additional_device = excluded.can_use_additional_device,
    suspended_until = case when p_suspension_hours is null then public.account_controls.suspended_until else excluded.suspended_until end,
    suspension_reason = case when p_suspension_hours is null then public.account_controls.suspension_reason else excluded.suspension_reason end,
    suspended_by = case when p_suspension_hours is null then public.account_controls.suspended_by else excluded.suspended_by end,
    updated_at = now(), updated_by = auth.uid();

  if not v_additional_device then
    delete from public.device_sessions
    where user_id = p_target
      and device_id not in (
        select device_id from public.device_sessions where user_id = p_target
        order by created_at desc, last_seen_at desc, device_id limit 1
      );
  end if;

  update public.profiles set is_admin = coalesce(p_is_manager, false) where id = p_target;
  select to_jsonb(c) into v_new from public.account_controls c where c.user_id = p_target;
  insert into public.account_admin_audit(target_user_id, actor_user_id, action, details)
  values (p_target, auth.uid(), 'account_controls_updated',
    jsonb_build_object('before', v_old, 'after', v_new, 'is_manager', coalesce(p_is_manager, false)));
end;
$function$;

revoke all on function public.claim_device_session(uuid, text) from public, anon;
revoke all on function public.heartbeat_device_session(uuid) from public, anon;
grant execute on function public.claim_device_session(uuid, text) to authenticated;
grant execute on function public.heartbeat_device_session(uuid) to authenticated;
