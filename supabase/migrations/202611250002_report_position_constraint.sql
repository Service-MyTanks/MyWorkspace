-- MyWorkspace: keep the reports position constraint in sync with the report form.
-- The form includes the Special Administrator roles added after the original reports schema.
begin;

alter table public.reports
  drop constraint if exists reports_position_check;

alter table public.reports
  add constraint reports_position_check
  check (position = any (array[
    'Младший Хелпер',
    'Хелпер',
    'Младший модератор',
    'Модератор',
    'Старший модератор',
    'Администратор',
    'Старший администратор',
    'Тестировщик',
    'Медиа-продакшн',
    'Технический специалист',
    'Следящий за форумом',
    'Старший следящий за форумом',
    'Следящий за битвами',
    'Старший следящий за битвами',
    'Зам.куратора технических специалистов',
    'Куратор технических специалистов',
    'Зам куратора администрации',
    'Куратор администрации',
    'Заместитель Куратора Агентов Поддержки',
    'Куратор Агентов Поддержки',
    'Заместитель главного администратора',
    'Главный администратор',
    'Заместитель Специального Администратора',
    'Специальный Администратор'
  ]::text[]));

commit;
