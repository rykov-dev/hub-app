# Deity

Продакшен-версия (ветка `main`): Inbox для мыслей и ежедневные серии. Хаб с чатом, игрой
и связями развивается в `dev`.
[Суть приложения и связь с hub](VISION.md).

- **Inbox** — быстрые заметки: читать, добавлять теги и комментарии, удалять.
- **Серия** — заходи каждый день: монетки за визит и бонус за дни подряд.
- **Офлайн** — всё, кроме получения наград, работает без сети и синхронизируется потом.

React + Rsbuild фронтенд, Supabase (Postgres, Auth, Edge Functions) вместо бэкенда.
Вход через Google, GitHub или по email и паролю (Supabase Auth), без подтверждения почты
и без отправки писем.

## Хранение данных

Заметки (`inbox_notes`) и комментарии (`inbox_note_comments`) хранятся в Supabase Postgres открытым
текстом; доступ ограничен Supabase Auth и RLS, транспорт — HTTPS. Клиентского шифрования нет:
Deity Vault из v1.0.0 убран в v1.0.1, данные при переходе стёрты. Подробнее и о возможном возврате
шифрования — [docs/encryption.md](docs/encryption.md) и [docs/vault-migration.md](docs/vault-migration.md).

## Награды

| Награда | Сколько | Когда |
|---|---|---|
| Ежедневный визит | 10 | первый заход за сутки (UTC) |
| Бонус за серию | +5 за каждый день подряд, максимум +30 с 7-го дня | вместе с ежедневной наградой |
| Заметка в Inbox | 1 за символ (без пробелов по краям) | за каждую заметку |

Монеты начисляются только на сервере: edge function `claim-daily` вызывает `claim_daily_reward`
в Postgres, доступную только `service_role`. Каждая награда записывается в `coin_transactions`
с уникальным ключом на `(user_id, reason, day)`, поэтому повторно её не получить. Константы —
в `supabase/migrations/*_coins.sql` (`streak_bonus`, `v_daily_reward`). Монеты за заметку
начисляет триггер при вставке в `inbox_notes`, при удалении заметки они остаются.

## Офлайн

- Service worker кэширует оболочку приложения: после первого визита оно открывается без сети.
- Профиль, монеты, история, заметки и комментарии хранятся в IndexedDB (`src/lib/offline/`):
  экран сразу показывает сохранённое и обновляет его с сервера.
- Заметки, теги, комментарии и удаление всегда проходят через очередь (`outbox.ts`): видны сразу,
  а на сервер уходят, когда есть сеть. Id генерирует клиент, поэтому повторная отправка не создаёт
  дубликатов.
- Награды требуют сервера: монеты за заметку начисляются при синхронизации, ежедневная награда —
  при появлении сети.
- При выходе офлайн-данные удаляются с устройства, кроме несинхронизированных изменений.
- Версия офлайн-данных — `LOCAL_DATA_VERSION` в `src/lib/offline/storage.ts`. Если на устройстве
  данные старой версии, при запуске они стираются целиком (так убраны ключ и кэш Vault из v1.0.0).

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

Фронтенд деплоится в GitHub Pages workflow-ом `.github/workflows/deploy.yml` только по тегу
версии `vX.Y.Z` на коммите из `main` (Settings → Pages → Source: GitHub Actions; в Settings →
Environments → github-pages разрешить деплой из тегов `v*`). Сайт: https://rykov-dev.github.io/hub-app/

## Ветки и релизы

- `dev` — разработка: все правки и изменения делаются здесь.
- `main` — прод (Deity): в неё попадают только готовые изменения из `dev` (merge), напрямую в `main`
  не коммитим. В `main` нет разделов хаба (чат, игра, связи, база знаний, таймер 15 минут) —
  при merge из `dev` их не возвращать.
- Деплоятся только коммиты `main` с тегом версии; push в `main` или `dev` сам по себе ничего не деплоит.
- Выпуск версии:
  1. В `dev` поднять `version` в `package.json`, закоммитить.
  2. `git switch main && git merge --ff-only dev` (или merge-коммит, если `main` ушла вперёд хотфиксом).
  3. `git tag -a vX.Y.Z -m "vX.Y.Z" && git push origin main vX.Y.Z` — тег запускает деплой.
  4. Миграции применить `bun run deploy` (из `main`).
- Откат — повторно запустить деплой старого тега (Actions → Deploy → Re-run) или выпустить
  новую версию с исправлением.
