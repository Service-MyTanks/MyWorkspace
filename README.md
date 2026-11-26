# MT DOCS · Рабочее пространство команды MyTanks

Служебное SPA для команды: ежедневные отчёты, учёт блокировок (баны/кики/муты/предупреждения), личный кабинет, одобрение заявок руководителем.

**Стек:** ванильный JS + Supabase (auth, Postgres, RLS). Без сборки — статические файлы.

## Структура

```
index.html            разметка, CSP, SVG-иконки, диалоги
app.js                вся логика (роутинг на хэшах, формы, Supabase)
styles.css            тёмная тема
config.js             публичный URL и publishable-ключ Supabase, ссылка на форму отчётов
vendor/supabase.js    supabase-js 2.119.1 (вендорен локально)
favicon*, *.png, mytanks-avatar.jpg   иконки и аватар
.nojekyll             отключает Jekyll на GitHub Pages
```

## Публикация (GitHub Pages)

Сайт полностью статический, все пути относительные — работает в подпапке репозитория.
Адрес: `https://service-mytanks.github.io/MyWorkspace/`
Репозиторий: `[https://github.com/Service-MyTanks/MyWorkspace/]` (публичный).

1. Содержимое этой папки лежит в корне репозитория (ветка `main`).
2. Settings → Pages → Source: **Deploy from a branch**, Branch: `main`, папка `/ (root)`.
3. **Supabase → Authentication → URL Configuration → Redirect URLs** — добавить адрес сайта, иначе письма подтверждения/восстановления не будут редиректить на приложение.

## Глобальная праздничная тема

После базовой схемы и миграции настроек аккаунта выполните в Supabase SQL Editor миграцию `supabase/migrations/202611210001_global_workspace_theme.sql`.

Она создаёт глобальную настройку оформления. Только подтверждённый и одобренный аккаунт с закреплённой почтой `supportmytanks@gmail.com` может включать или отключать Новогоднюю тему для всех пользователей. Право проверяется на стороне PostgreSQL через RPC; клиентский интерфейс не является механизмом защиты. Личные цветовые схемы пользователей сохраняются и автоматически возвращаются после отключения глобальной темы. Изменение распространяется на уже открытые сессии через Supabase Realtime.

## Список должностей

Иерархия из 6 уровней, 24 должности. Список задан в **двух местах** и должен совпадать:

- `index.html` — `<select id="register-position">` (optgroup по уровням);
- `app.js` — константа `POSITIONS` (валидация при регистрации).

Если на `profiles.position` в БД есть CHECK-ограничение — обновите и его (см. `supabase-migration.sql` в материалах проекта).

## Безопасность

- Publishable-ключ Supabase публичный по дизайну; данные защищает RLS (анонимному доступ закрыт полностью).
- CSP через `<meta>`, без inline-скриптов; пользовательский ввод только через `textContent`.
- Админ-действия — через RPC `set_account_status` с серверной проверкой прав.
- Регистрация ≠ доступ: заявка проходит подтверждение почты и одобрение руководителем.


## Google sign-in and backup password

Google sign-in is available alongside email/password authentication. New Google users must set a backup password and submit their employee nickname and position before their account can enter the workspace. The database creates their profile with the default `pending` status; a manager must still approve access.

To enable the provider:

1. Create a Google OAuth 2.0 Web application in Google Cloud Console.
2. Add this authorized redirect URI to the Google OAuth client: `https://nrurjjklmypodbvwwele.supabase.co/auth/v1/callback`.
3. In Supabase → Authentication → Providers → Google, enable Google and enter the OAuth Client ID and Client Secret. Keep the secret in Supabase only; never add it to this repository.
4. In Supabase → Authentication → URL Configuration → Redirect URLs, allow `https://service-mytanks.github.io/MyWorkspace/` and the local test URL `http://localhost:8000/`.
5. Apply migration `supabase/migrations/20261126204300_google_oauth_registration.sql`.

Existing email/password users can continue using their current login. If they sign in with Google using the same verified email, Supabase can link the verified identity to the existing account.
