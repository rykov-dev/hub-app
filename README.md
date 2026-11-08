# Монетки

[Суть приложения и связь с hub](VISION.md).

Хаб с четырьмя разделами: база знаний, чат, игра и редактор связей. На главной — дашборд с монетками
и входы в разделы. Готовы игра, Inbox (входящие базы знаний) и чат (только в dev); редактор связей и сама база знаний
пока заглушки. Список разделов — `src/lib/sections.ts`.

Чат работает только в dev-среде, с локальной моделью Bonsai (llama.cpp, OpenAI-совместимый API):
`bun run bonsai` запускает `../bonsai/bin/llama-server` на `127.0.0.1:8081`, dev-сервер проксирует
к нему `/llm`. Настройки чата (модель, системный промпт, температура, лимиты) —
`src/lib/chat/config.ts`; путь, модель и порт сервера меняются через `BONSAI_DIR`, `BONSAI_MODEL`,
`BONSAI_PORT`, адрес для прокси — `BONSAI_URL`. В продакшен-сборке чат остаётся заглушкой.
Чаты сохраняются в Supabase (`chats`, `chat_messages`) через ту же очередь, что и заметки, поэтому
переписка с локальной моделью без интернета досинхронизируется позже. Монеток за чат нет.

React + Rsbuild фронтенд, Supabase (Postgres, Auth, Edge Functions) вместо бэкенда.
Вход через Google, GitHub или по email и паролю (Supabase Auth), без подтверждения почты
и без отправки писем.

## Правила наград

| Награда | Сколько | Когда |
|---|---|---|
| Ежедневный визит | 10 | первый заход за сутки (UTC) |
| Бонус за серию | +5 за каждый день подряд, максимум +30 с 7-го дня | вместе с ежедневной наградой |
| 15 минут на сайте | 10 | раз в сутки, за 15 минут подряд на открытой вкладке |
| Заметка в Inbox | 1 за символ (без пробелов по краям) | за каждую заметку |

Тратятся монетки в игре (раздел «Игра»): игра из `project-25` в iframe. Приложение даёт ей
только API монеток через `postMessage` (баланс и списание), что и почём покупать — решает игра.
Адрес игры — `PUBLIC_WORLD_URL`, протокол — [docs/world-iframe-api.md](docs/world-iframe-api.md).

Монеты начисляются только на сервере. Edge functions `claim-daily` и `heartbeat` вызывают функции
`claim_daily_reward` / `record_heartbeat` в Postgres, которые может выполнять только `service_role`.
Каждая награда записывается в `coin_transactions` с уникальным ключом `(user_id, reason, day)`,
поэтому повторно её получить нельзя. Непрерывное время считает сервер: пока вкладка видима,
клиент раз в минуту шлёт heartbeat, сервер хранит начало текущей сессии (`activity_sessions`)
и начинает новую, если между heartbeat прошло больше 90 секунд. Несколько вкладок время не ускоряют.

Константы наград лежат в `supabase/migrations/*_coins.sql` (`streak_bonus`, `v_daily_reward`,
`v_reward`, `v_required_seconds`).

## Офлайн

- Service worker кэширует оболочку приложения: после первого визита оно открывается без сети.
- Профиль, монеты, история, заметки и комментарии хранятся в IndexedDB (`src/lib/offline/`):
  экран сразу показывает сохранённое и обновляет его с сервера.
- Заметки, теги и комментарии всегда проходят через очередь (`outbox.ts`): видны сразу, а на сервер
  уходят, когда есть сеть. Id генерирует клиент, поэтому повторная отправка не создаёт дубликатов.
- Награды требуют сервера: монеты за заметку начисляются при синхронизации, ежедневная награда —
  при появлении сети, время офлайн в 15 минут не засчитывается.
- При выходе офлайн-данные удаляются с устройства, кроме несинхронизированных изменений.
- Версия офлайн-данных — `LOCAL_DATA_VERSION` в `src/lib/offline/storage.ts`. Если на устройстве
  данные старой версии, при запуске они стираются целиком (так убраны ключ и кэш прежнего
  зашифрованного Vault).

## Хранение данных

Данные хранятся в Supabase Postgres открытым текстом, доступ ограничен Supabase Auth и RLS,
транспорт — HTTPS. Клиентского шифрования нет: прежний Deity Vault (v1.0.0) убран, данные при
переходе стёрты. Подробнее и о возможном возврате шифрования — [docs/encryption.md](docs/encryption.md).

## Локальный запуск

Проще всего — в dev-контейнере (`.devcontainer/`): VS Code «Reopen in Container» или GitHub
Codespaces. В нём bun нужной версии, Node и Docker для локального Supabase; зависимости ставятся
при создании контейнера. Без контейнера нужны bun, Node и Docker.

```sh
bun install                   # в контейнере уже сделано
bun run db:start              # поднимает Supabase в Docker и применяет миграции
bun run local:env             # пишет URL и ключ локального Supabase в .env.local
bun run functions:serve       # edge functions (в отдельном терминале)
bun run dev                   # http://localhost:3000
```

`.env.local` перекрывает `.env`; чтобы снова работать с удалённым проектом, удали его
(для удалённого: `cp .env.example .env` и publishable key из `bunx supabase projects api-keys`).
Studio локальной базы — http://localhost:54323. Вход локально — по email и паролю
(Google и GitHub настроены только в удалённом проекте).

## Деплой

```sh
bunx supabase link --project-ref <ref>
bun run deploy
```

В Dashboard → Authentication → Sign In / Providers → Email выключить «Confirm email»
(локально это `enable_confirmations = false` в `supabase/config.toml`), иначе после регистрации
Supabase будет ждать подтверждения по почте.

Google и GitHub включаются в Dashboard → Authentication → Sign In / Providers (ключи OAuth-приложений
хранятся только там). Callback URL в OAuth-приложениях:
`https://vfnpkkzaxsraakeacchg.supabase.co/auth/v1/callback`. Адреса, куда можно вернуться после входа,
заданы в `additional_redirect_urls` в `supabase/config.toml`.

Фронтенд деплоится в GitHub Pages workflow-ом `.github/workflows/deploy.yml` из ветки `release`
(Settings → Pages → Source: GitHub Actions). Сайт: https://rykov-dev.github.io/hub-app/

## Ветки и релизы

- Вся разработка — только в `main`: код, миграции, документация, версия в `package.json`.
- `release` содержит только выпущенную версию и собирается cherry-pick-ом нужных коммитов из `main`.
  Своих коммитов и merge в `release` не делаем: правка для релиза — сначала коммит в `main`.
- Выпуск версии:
  1. В `main` поднять `version` в `package.json`, закоммитить.
  2. `git switch release && git cherry-pick -x <коммиты из main>` — нужные изменения и коммит версии.
  3. Тег на `release`: `git tag -a vX.Y.Z -m "vX.Y.Z"`, затем `git push origin release vX.Y.Z`
     (push в `release` запускает деплой).
  4. Миграции применить `bun run deploy`.
