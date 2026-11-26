create or replace function public.complete_google_registration(p_nickname text, p_position text)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_email text;
begin
  if v_user_id is null then raise exception 'Требуется авторизация' using errcode = '42501'; end if;
  if not exists (select 1 from auth.identities where user_id = v_user_id and provider = 'google') then
    raise exception 'Регистрация доступна только после подтверждения через Google' using errcode = '42501';
  end if;
  select email into v_email from auth.users where id = v_user_id and email_confirmed_at is not null;
  if v_email is null then raise exception 'Не удалось подтвердить адрес электронной почты Google' using errcode = '42501'; end if;
  if not exists (select 1 from auth.users where id = v_user_id and coalesce(encrypted_password, '') <> '') then
    raise exception 'Сначала задайте резервный пароль для входа по электронной почте' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where id = v_user_id) then raise exception 'Профиль уже существует' using errcode = '23505'; end if;
  if p_nickname is null or char_length(btrim(p_nickname)) not between 2 and 64 then raise exception 'Никнейм должен содержать от 2 до 64 символов'; end if;
  if p_position is null or not (p_position = any (array[
    'Младший Хелпер', 'Хелпер', 'Младший модератор', 'Модератор', 'Старший модератор', 'Администратор', 'Старший администратор',
    'Тестировщик', 'Медиа-продакшн', 'Технический специалист', 'Следящий за форумом', 'Старший следящий за форумом',
    'Следящий за битвами', 'Старший следящий за битвами', 'Зам.куратора технических специалистов', 'Куратор технических специалистов',
    'Зам куратора администрации', 'Куратор администрации', 'Заместитель Куратора Агентов Поддержки', 'Куратор Агентов Поддержки',
    'Заместитель главного администратора', 'Главный администратор', 'Заместитель Специального Администратора', 'Специальный Администратор'
  ]::text[])) then raise exception 'Выберите должность из списка'; end if;
  insert into public.profiles (id, email, nickname, position) values (v_user_id, v_email, btrim(p_nickname), p_position);
end;
$function$;
revoke all on function public.complete_google_registration(text, text) from public, anon;
grant execute on function public.complete_google_registration(text, text) to authenticated;
