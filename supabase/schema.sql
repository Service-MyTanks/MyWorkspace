-- MT DOCS Workspace: run once in Supabase Dashboard → SQL Editor.

create type public.account_status as enum ('pending', 'approved', 'rejected');
create type public.sanction_kind as enum ('ban', 'kick', 'mute', 'warning');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  nickname text not null check (char_length(btrim(nickname)) between 2 and 64),
  position text not null check (position in (
    'Младший Хелпер', 'Хелпер',
    'Младший модератор', 'Модератор', 'Старший модератор', 'Администратор', 'Старший администратор',
    'Тестировщик', 'Медиа-продакшн', 'Технический специалист', 'Следящий за форумом',
    'Старший следящий за форумом', 'Следящий за битвами', 'Старший следящий за битвами',
    'Зам.куратора технических специалистов', 'Куратор технических специалистов',
    'Зам куратора администрации', 'Куратор администрации',
    'Заместитель Куратора Агентов Поддержки', 'Куратор Агентов Поддержки',
    'Заместитель главного администратора', 'Главный администратор',
    'Заместитель Специального Администратора', 'Специальный Администратор'
  )),
  status public.account_status not null default 'pending',
  is_admin boolean not null default false,
  manual_report_position boolean not null default false,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null
);
create unique index profiles_nickname_key on public.profiles (lower(btrim(nickname)));

create table public.reports (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  report_date date not null,
  nickname text not null check (char_length(nickname) between 1 and 64),
  position text not null check (char_length(position) between 1 and 80),
  online_minutes integer not null check (online_minutes between 0 and 1440),
  report_count integer not null check (report_count between 0 and 99999),
  subject text not null check (char_length(subject) <= 300),
  body text not null check (char_length(body) between 1 and 40000),
  screenshots text[] not null default '{}' check (cardinality(screenshots) <= 3),
  created_at timestamptz not null default now()
);
create index reports_user_created_idx on public.reports (user_id, created_at desc);

create table public.sanctions (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind public.sanction_kind not null,
  player_nickname text not null check (char_length(btrim(player_nickname)) between 1 and 64),
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  duration_minutes integer check (duration_minutes between 1 and 5256000),
  is_permanent boolean not null default false,
  evidence_url text check (evidence_url is null or (evidence_url ~ '^https?://[^\s]+$' and char_length(evidence_url) <= 2000)),
  comment text check (comment is null or char_length(comment) <= 1000),
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (
    case kind
      when 'ban' then (is_permanent and duration_minutes is null) or (not is_permanent and duration_minutes is not null)
      when 'mute' then not is_permanent and duration_minutes is not null
      else not is_permanent and duration_minutes is null
    end
  )
);
create index sanctions_user_kind_idx on public.sanctions (user_id, kind, issued_at desc);

create function public.is_approved() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'approved');
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'approved' and is_admin);
$$;

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $
declare
  v_nickname text;
  v_position text;
begin
  v_nickname := nullif(btrim(new.raw_user_meta_data ->> 'nickname'), '');
  v_position := nullif(btrim(new.raw_user_meta_data ->> 'position'), '');

  -- OAuth users complete their employee profile after the first sign-in.
  if v_nickname is null or v_position is null then
    return new;
  end if;

  insert into public.profiles (id, email, nickname, position)
  values (new.id, coalesce(new.email, ''), v_nickname, v_position);
  return new;
end;
$;

create function public.complete_google_registration(p_nickname text, p_position text)
returns void
language plpgsql
security definer
set search_path = ''
as $
declare
  v_user_id uuid := auth.uid();
  v_email text;
begin
  if v_user_id is null then
    raise exception 'Требуется авторизация' using errcode = '42501';
  end if;

  if not exists (
    select 1 from auth.identities
    where user_id = v_user_id and provider = 'google'
  ) then
    raise exception 'Регистрация доступна только после подтверждения через Google' using errcode = '42501';
  end if;

  select email into v_email
  from auth.users
  where id = v_user_id and email_confirmed_at is not null;

  if v_email is null then
    raise exception 'Не удалось подтвердить адрес электронной почты Google' using errcode = '42501';
  end if;

  if exists (select 1 from public.profiles where id = v_user_id) then
    raise exception 'Профиль уже существует' using errcode = '23505';
  end if;

  if p_nickname is null or char_length(btrim(p_nickname)) not between 2 and 64 then
    raise exception 'Никнейм должен содержать от 2 до 64 символов';
  end if;

  if p_position is null or not (p_position = any (array[
    'Младший Хелпер', 'Хелпер',
    'Младший модератор', 'Модератор', 'Старший модератор', 'Администратор', 'Старший администратор',
    'Тестировщик', 'Медиа-продакшн', 'Технический специалист', 'Следящий за форумом',
    'Старший следящий за форумом', 'Следящий за битвами', 'Старший следящий за битвами',
    'Зам.куратора технических специалистов', 'Куратор технических специалистов',
    'Зам куратора администрации', 'Куратор администрации',
    'Заместитель Куратора Агентов Поддержки', 'Куратор Агентов Поддержки',
    'Заместитель главного администратора', 'Главный администратор',
    'Заместитель Специального Администратора', 'Специальный Администратор'
  ]::text[])) then
    raise exception 'Выберите должность из списка';
  end if;

  insert into public.profiles (id, email, nickname, position)
  values (v_user_id, v_email, btrim(p_nickname), p_position);
end;
$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create function public.set_own_manual_report_position(enabled boolean)
returns void language plpgsql security definer set search_path = '' as $
begin
  if auth.uid() is null then raise exception 'Требуется авторизация' using errcode = '42501'; end if;
  update public.profiles set manual_report_position = coalesce(enabled, false) where id = auth.uid();
  if not found then raise exception 'Профиль не найден' using errcode = 'P0002'; end if;
end;
$;

create function public.set_account_status(target uuid, new_status public.account_status) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Недостаточно прав' using errcode = '42501';
  end if;
  if target = auth.uid() then
    raise exception 'Нельзя изменить статус собственного аккаунта' using errcode = '42501';
  end if;
  update public.profiles
  set status = new_status, reviewed_at = now(), reviewed_by = auth.uid()
  where id = target;
  if not found then
    raise exception 'Аккаунт не найден' using errcode = 'P0002';
  end if;
end;
$$;

alter table public.profiles enable row level security;
alter table public.reports enable row level security;
alter table public.sanctions enable row level security;

create policy "profiles: own or admin" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());

create policy "reports: own or admin read" on public.reports
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "reports: approved insert own" on public.reports
  for insert to authenticated with check (user_id = auth.uid() and public.is_approved());

create policy "sanctions: own or admin read" on public.sanctions
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "sanctions: approved insert own" on public.sanctions
  for insert to authenticated with check (user_id = auth.uid() and public.is_approved());
create policy "sanctions: approved delete own" on public.sanctions
  for delete to authenticated using (user_id = auth.uid() and public.is_approved());

revoke all on public.profiles, public.reports, public.sanctions from anon, authenticated;
grant select on public.profiles to authenticated;
grant select, insert on public.reports to authenticated;
grant select, insert, delete on public.sanctions to authenticated;

revoke all on function public.is_approved(), public.is_admin(), public.handle_new_user(),
  public.set_account_status(uuid, public.account_status),
  public.set_own_manual_report_position(boolean),
  public.complete_google_registration(text, text) from public, anon, authenticated;
grant execute on function public.is_approved(), public.is_admin(),
  public.set_account_status(uuid, public.account_status),
  public.set_own_manual_report_position(boolean),
  public.complete_google_registration(text, text) to authenticated;

-- After registering your own account on the site, make it the first administrator
-- (replace the email):
-- update public.profiles set status = 'approved', is_admin = true, reviewed_at = now()
-- where email = 'your-email@example.com';

-- Account self-service extensions are in supabase/migrations/202611200001_account_settings.sql.
-- Run that migration after applying this initial schema to enable avatar storage and account settings.
