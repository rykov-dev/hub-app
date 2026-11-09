# Разработка и выпуск

Общий документ для всех веток. README в `main` описывает прод (Deity).

## Локальный запуск

Проще всего — в dev-контейнере (`.devcontainer/`): VS Code «Reopen in Container» или GitHub
Codespaces. В нём bun нужной версии, Node и Docker для локального Supabase; зависимости ставятся
при создании контейнера. Без контейнера нужны bun, Node и Docker.

```sh
bun install                   # в контейнере уже сделано
bun dev                       # всё окружение разработки, http://localhost:3000
```

`bun dev` (`scripts/dev.ts`):
1. поднимает локальный Supabase в Docker, если он не запущен (миграции применяются при старте);
2. пишет его URL и ключ в `.env.local`, поэтому в dev приложение работает только с локальной базой;
3. запускает edge functions, dev-сервер Rsbuild и, если `../bonsai` есть, локальную модель для чата.

Ctrl+C останавливает процессы, Supabase остаётся работать (`bun run db:stop` — остановить,
`bun run db:reset` — пересоздать базу с нуля). Только фронтенд без остального — `bun run dev:web`.
Studio локальной базы — http://localhost:54323, письма — http://localhost:54324. Вход локально —
по email и паролю (Google и GitHub настроены только в удалённом проекте).

## Деплой

```sh
bunx supabase link --project-ref <ref>
bun run deploy                # выпуск версии, см. «Ветки и релизы»
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

```
main ──●────────────────────────●── vX.Y.Z (тег → деплой)
        \                      /
         feature ──●──●──●────●        (тематическая ветка от main)
                    \        \
dev ─────────────────●────────●──       (стенд: вливаем, проверяем; в main не идёт)
```

- `main` — прод (Deity). Напрямую в `main` не коммитим.
- Каждая задача — тематическая ветка от свежей `main` (например, `mvp-v1`).
- Проверка: тематическую ветку вливают в `dev` (`git switch dev && git merge mvp-v1`) и проверяют
  там вместе с остальным. Правки по итогам делаются в тематической ветке и снова вливаются в `dev`.
- `dev` в `main` не вливается никогда. В нём живут и разделы хаба (чат, игра, связи, база знаний,
  таймер 15 минут), которых в `main` нет. Если `dev` разошёлся с `main` и мешает, его можно
  пересоздать: `git switch -C dev main`, влить нужные ветки и запушить с `--force-with-lease`.
- Готовая ветка вливается в `main` (merge или PR), после этого — выпуск.
- Деплоятся только коммиты `main` с тегом версии; push в ветки сам по себе ничего не деплоит.
- Выпуск версии — `bun run deploy [patch|minor|major|X.Y.Z]` из `main` (по умолчанию `patch`,
  `scripts/deploy.ts`):
  1. проверяет: ветка `main`, нет незакоммиченных изменений, `main` не отстаёт от origin,
     typecheck и сборка проходят; показывает коммиты с прошлого тега;
  2. поднимает `version` в `package.json`, коммитит `chore: release vX.Y.Z` в `main` и ставит тег;
  3. показывает миграции, которых ещё нет в production, и спрашивает подтверждение (`--yes` — без
     вопроса); до этого места всё откатывается при отмене или ошибке;
  4. применяет миграции и деплоит edge functions в Supabase, пушит `main` и тег — тег запускает
     деплой фронтенда.
  Нужен `supabase link --project-ref vfnpkkzaxsraakeacchg`. `bun deploy` без `run` не работает:
  эта подкоманда зарезервирована Bun.
- Миграции попадают в production только при выпуске. Тематическая ветка с миграцией, влитая
  в `dev`, проверяется на локальной базе (`bun dev`, `bun run db:reset`).
- Откат — повторно запустить деплой старого тега (Actions → Deploy → Re-run) или выпустить
  новую версию с исправлением.
