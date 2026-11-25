-- Account controls and manager panel.
-- Applied to the linked Supabase project as migration account_control_panel.

create table if not exists public.account_controls (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  allowed_themes text[] not null default array['mt-standard','graphite','midnight','emerald','cherry','snow','violet']::text[],
  can_change_nickname boolean not null default true,
  can_change_email boolean not null default true,
  can_upload_avatar boolean not null default true,
  can_access_training boolean not null default true,
  suspended_until timestamptz,
  suspension_reason text,
  suspended_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  constraint account_controls_allowed_themes_check check (
    cardinality(allowed_themes) <= 7
    and allowed_themes <@ array['mt-standard','graphite','midnight','emerald','cherry','snow','violet']::text[]
  )
);

insert into public.account_controls (user_id)
select id from public.profiles
on conflict (user_id) do nothing;

create table if not exists public.account_admin_audit (
  id bigint generated always as identity primary key,
  target_user_id uuid references public.profiles(id) on delete set null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.account_controls enable row level security;
alter table public.account_admin_audit enable row level security;

drop policy if exists "account controls: own or admin read" on public.account_controls;
create policy "account controls: own or admin read"
on public.account_controls for select to authenticated
using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists "account admin audit: admin read" on public.account_admin_audit;
create policy "account admin audit: admin read"
on public.account_admin_audit for select to authenticated
using (public.is_admin());

revoke all on public.account_controls from anon, authenticated;
grant select on public.account_controls to authenticated;
revoke all on public.account_admin_audit from anon, authenticated;
grant select on public.account_admin_audit to authenticated;

create or replace function public.is_approved()
returns boolean language sql stable security definer set search_path = ''
as $function$
  select exists (
    select 1 from public.profiles p
    left join public.account_controls c on c.user_id = p.id
    where p.id = auth.uid() and p.status = 'approved'
      and (c.suspended_until is null or c.suspended_until <= now())
  );
$function$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $function$
  select exists (
    select 1 from public.profiles p
    left join public.account_controls c on c.user_id = p.id
    where p.id = auth.uid() and p.status = 'approved' and p.is_admin = true
      and (c.suspended_until is null or c.suspended_until <= now())
  );
$function$;

create or replace function public.set_own_avatar_path(new_path text)
returns void language plpgsql security definer set search_path = ''
as $function$
declare expected_path text;
begin
  if auth.uid() is null then raise exception 'Требуется авторизация' using errcode = '42501'; end if;
  expected_path := auth.uid()::text || '/avatar.webp';
  if new_path is not null and new_path <> expected_path then raise exception 'Недопустимый путь аватара' using errcode = '42501'; end if;
  if new_path is not null and not coalesce((select c.can_upload_avatar from public.account_controls c where c.user_id = auth.uid()), true) then
    raise exception 'Загрузка аватара запрещена для этого аккаунта' using errcode = '42501';
  end if;
  update public.profiles set avatar_path = new_path where id = auth.uid();
  if not found then raise exception 'Профиль не найден' using errcode = 'P0002'; end if;
end;
$function$;

create or replace function public.update_own_nickname(new_nickname text)
returns void language plpgsql security definer set search_path = ''
as $function$
declare normalized text := btrim(coalesce(new_nickname, ''));
begin
  if auth.uid() is null then raise exception 'Требуется авторизация' using errcode = '42501'; end if;
  if char_length(normalized) not between 2 and 64 then raise exception 'Никнейм должен содержать от 2 до 64 символов' using errcode = '22023'; end if;
  if not coalesce((select c.can_change_nickname from public.account_controls c where c.user_id = auth.uid()), true) then
    raise exception 'Изменение никнейма запрещено для этого аккаунта' using errcode = '42501';
  end if;
  update public.profiles set nickname = normalized where id = auth.uid();
  if not found then raise exception 'Профиль не найден' using errcode = 'P0002'; end if;
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
    user_id, allowed_themes, can_change_nickname, can_change_email, can_upload_avatar,
    can_access_training, suspended_until, suspension_reason, suspended_by, updated_at, updated_by
  ) values (
    p_target, v_themes,
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
    can_change_nickname = excluded.can_change_nickname,
    can_change_email = excluded.can_change_email,
    can_upload_avatar = excluded.can_upload_avatar,
    can_access_training = excluded.can_access_training,
    suspended_until = excluded.suspended_until,
    suspension_reason = excluded.suspension_reason,
    suspended_by = excluded.suspended_by,
    updated_at = now(), updated_by = auth.uid();
  update public.profiles set is_admin = coalesce(p_is_manager, false) where id = p_target;
  select to_jsonb(c) into v_new from public.account_controls c where c.user_id = p_target;
  insert into public.account_admin_audit(target_user_id, actor_user_id, action, details)
  values (p_target, auth.uid(), 'account_controls_updated',
    jsonb_build_object('before', v_old, 'after', v_new, 'is_manager', coalesce(p_is_manager, false)));
end;
$function$;

revoke all on function public.admin_update_account_controls(uuid,jsonb,boolean,integer,text) from public, anon;
grant execute on function public.admin_update_account_controls(uuid,jsonb,boolean,integer,text) to authenticated;

drop policy if exists "avatars: owner insert" on storage.objects;
create policy "avatars: owner insert" on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and name = (auth.uid())::text || '/avatar.webp'
  and coalesce((select c.can_upload_avatar from public.account_controls c where c.user_id = auth.uid()), true));

drop policy if exists "avatars: owner update" on storage.objects;
create policy "avatars: owner update" on storage.objects for update to authenticated
using (bucket_id = 'avatars' and name = (auth.uid())::text || '/avatar.webp'
  and coalesce((select c.can_upload_avatar from public.account_controls c where c.user_id = auth.uid()), true))
with check (bucket_id = 'avatars' and name = (auth.uid())::text || '/avatar.webp'
  and coalesce((select c.can_upload_avatar from public.account_controls c where c.user_id = auth.uid()), true));
