-- Store a server-validated preferred theme for each account.
alter table public.account_controls
  add column if not exists preferred_theme text not null default 'mt-standard';

alter table public.account_controls
  drop constraint if exists account_controls_preferred_theme_check;
alter table public.account_controls
  add constraint account_controls_preferred_theme_check
  check (preferred_theme = any(array['mt-standard','graphite','midnight','emerald','cherry','snow','violet']::text[]));

update public.account_controls
set preferred_theme = case
  when preferred_theme = any(allowed_themes) then preferred_theme
  when cardinality(allowed_themes) > 0 then allowed_themes[1]
  else 'mt-standard'
end;

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
    can_upload_avatar, can_access_training, suspended_until, suspension_reason,
    suspended_by, updated_at, updated_by
  ) values (
    p_target, v_themes, case when cardinality(v_themes) > 0 then v_themes[1] else 'mt-standard' end,
    coalesce((p_settings->>'can_change_nickname')::boolean, true),
    coalesce((p_settings->>'can_change_email')::boolean, true),
    coalesce((p_settings->>'can_upload_avatar')::boolean, true),
    coalesce((p_settings->>'can_access_training')::boolean, true),
    case when p_suspension_hours is null then null else now() + make_interval(hours => p_suspension_hours) end,
    case when p_suspension_hours is null then null else v_reason end,
    case when p_suspension_hours is null then null else auth.uid() end,
    now(), auth.uid()
  )
  on conflict (user_id) do update set
    allowed_themes = excluded.allowed_themes,
    preferred_theme = case
      when public.account_controls.preferred_theme = any(v_themes) then public.account_controls.preferred_theme
      when cardinality(v_themes) > 0 then v_themes[1]
      else 'mt-standard'
    end,
    can_change_nickname = excluded.can_change_nickname,
    can_change_email = excluded.can_change_email,
    can_upload_avatar = excluded.can_upload_avatar,
    can_access_training = excluded.can_access_training,
    suspended_until = case when p_suspension_hours is null then public.account_controls.suspended_until else excluded.suspended_until end,
    suspension_reason = case when p_suspension_hours is null then public.account_controls.suspension_reason else excluded.suspension_reason end,
    suspended_by = case when p_suspension_hours is null then public.account_controls.suspended_by else excluded.suspended_by end,
    updated_at = now(), updated_by = auth.uid();
  update public.profiles set is_admin = coalesce(p_is_manager, false) where id = p_target;
  select to_jsonb(c) into v_new from public.account_controls c where c.user_id = p_target;
  insert into public.account_admin_audit(target_user_id, actor_user_id, action, details)
  values (p_target, auth.uid(), 'account_controls_updated',
    jsonb_build_object('before', v_old, 'after', v_new, 'is_manager', coalesce(p_is_manager, false)));
end;
$function$;

create or replace function public.set_own_theme(p_theme text)
returns void language plpgsql security definer set search_path = ''
as $function$
begin
  if auth.uid() is null then raise exception 'Требуется авторизация' using errcode = '42501'; end if;
  if p_theme <> all(array['mt-standard','graphite','midnight','emerald','cherry','snow','violet']::text[]) then
    raise exception 'Неизвестная цветовая схема' using errcode = '22023';
  end if;
  update public.account_controls
  set preferred_theme = p_theme, updated_at = now()
  where user_id = auth.uid() and p_theme = any(allowed_themes);
  if not found then raise exception 'Эта цветовая схема недоступна для вашего аккаунта' using errcode = '42501'; end if;
end;
$function$;

revoke all on function public.set_own_theme(text) from public, anon;
grant execute on function public.set_own_theme(text) to authenticated;
