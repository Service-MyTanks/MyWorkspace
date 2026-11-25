-- Enforce the email-change permission when a user updates their own Auth account.
create or replace function public.protect_reserved_support_email()
returns trigger language plpgsql security definer set search_path = ''
as $function$
begin
  if lower(coalesce(old.email, '')) = 'supportmytanks@gmail.com'
     and lower(coalesce(new.email, '')) <> 'supportmytanks@gmail.com' then
    raise exception 'Служебный адрес электронной почты нельзя изменить' using errcode = '42501';
  end if;
  if lower(coalesce(new.email, '')) = 'supportmytanks@gmail.com'
     and lower(coalesce(old.email, '')) <> 'supportmytanks@gmail.com' then
    raise exception 'Этот адрес закреплён за служебным аккаунтом' using errcode = '23505';
  end if;
  if auth.uid() = old.id and new.email is distinct from old.email
     and not coalesce((select c.can_change_email from public.account_controls c where c.user_id = old.id), true) then
    raise exception 'Изменение электронной почты запрещено для этого аккаунта' using errcode = '42501';
  end if;
  return new;
end;
$function$;
