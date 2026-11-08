# Разработка и выпуск

Общий документ для `dev` и `main`. README в `main` описывает прод (Deity) и при выпуске
не перезаписывается.

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

- `dev` — разработка: все правки и изменения делаются здесь.
- `main` — прод (Deity): в неё попадают только готовые изменения из `dev` (merge), напрямую в `main`
  не коммитим. В `main` нет разделов хаба (чат, игра, связи, база знаний, таймер 15 минут) —
  при merge из `dev` их не возвращать.
- Деплоятся только коммиты `main` с тегом версии; push в `main` или `dev` сам по себе ничего не деплоит.
- Выпуск версии — `bun run deploy [patch|minor|major|X.Y.Z]` из `dev` (по умолчанию `patch`,
  `scripts/deploy.ts`):
  1. проверяет: ветка `dev`, нет незакоммиченных изменений, `dev` и `main` не отстают от origin,
     typecheck и сборка проходят;
  2. поднимает `version` в `package.json` и коммитит `chore: release vX.Y.Z` в `dev`;
  3. делает merge `dev` → `main`, проверяет сборку на `main` и ставит тег `vX.Y.Z`. Конфликты
     в `package.json` (в `main` своё название пакета) и `README.md` (в `main` своё описание)
     разрешает сам в пользу `main`, на остальных останавливается;
  4. показывает миграции, которых ещё нет в production, и спрашивает подтверждение (`--yes` — без
     вопроса); до этого места всё откатывается при отмене или ошибке;
  5. применяет миграции и деплоит edge functions в Supabase, пушит `dev`, `main` и тег — тег
     запускает деплой фронтенда.
  Нужен `supabase link --project-ref vfnpkkzaxsraakeacchg`. `bun deploy` без `run` не работает:
  эта подкоманда зарезервирована Bun.
- Откат — повторно запустить деплой старого тега (Actions → Deploy → Re-run) или выпустить
  новую версию с исправлением.
