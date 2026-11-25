-- MyWorkspace: include Technical Support and reject empty report positions.
-- Keep this whitelist synchronized with registration and report-form options.
begin;

alter table public.reports
  drop constraint if exists reports_position_check;

alter table public.reports
  add constraint reports_position_check
  check (position is not null
    and btrim(position) <> ''
    and position = any (array[
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
    'Техническая поддержка',
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
