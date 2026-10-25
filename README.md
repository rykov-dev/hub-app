# Монетки

React + Rsbuild фронтенд, Supabase (Postgres, Auth, Edge Functions) вместо бэкенда.
Вход по email и паролю (Supabase Auth), без подтверждения почты и без отправки писем.

## Правила наград

| Награда | Сколько | Когда |
|---|---|---|
| Ежедневный визит | 10 | первый заход за сутки (UTC) |
| Бонус за серию | +5 за каждый день подряд, максимум +30 с 7-го дня | вместе с ежедневной наградой |
| 15 минут на сайте | 10 | раз в сутки, за 15 минут подряд на открытой вкладке |

Монеты начисляются только на сервере. Edge functions `claim-daily` и `heartbeat` вызывают функции
`claim_daily_reward` / `record_heartbeat` в Postgres, которые может выполнять только `service_role`.
Каждая награда записывается в `coin_transactions` с уникальным ключом `(user_id, reason, day)`,
поэтому повторно её получить нельзя. Непрерывное время считает сервер: пока вкладка видима,
клиент раз в минуту шлёт heartbeat, сервер хранит начало текущей сессии (`activity_sessions`)
и начинает новую, если между heartbeat прошло больше 90 секунд. Несколько вкладок время не ускоряют.

Константы наград лежат в `supabase/migrations/*_coins.sql` (`streak_bonus`, `v_daily_reward`,
`v_reward`, `v_required_seconds`).

## Локальный запуск

Нужны bun и Docker.

```sh
bun install
cp .env.example .env
bun run db:start              # поднимает Supabase и применяет миграции
bunx supabase status          # для локальной БД: publishable key → PUBLIC_SUPABASE_PUBLISHABLE_KEY в .env
bun run functions:serve       # edge functions (в отдельном терминале)
bun run dev                   # http://localhost:3000
```

## Деплой

```sh
bunx supabase link --project-ref <ref>
bun run deploy
```

В Dashboard → Authentication → Sign In / Providers → Email выключить «Confirm email»
(локально это `enable_confirmations = false` в `supabase/config.toml`), иначе после регистрации
Supabase будет ждать подтверждения по почте.

Фронтенд деплоится в GitHub Pages workflow-ом `.github/workflows/deploy.yml` при каждом push в `main`
(Settings → Pages → Source: GitHub Actions). Сайт: https://rykov-dev.github.io/hub-app/
