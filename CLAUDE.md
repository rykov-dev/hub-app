# Правила проекта

## Ветки

- `dev` — разработка. Все правки и изменения делаются только в `dev`.
- `main` — прод. В неё только merge из `dev`; напрямую в `main` не коммитим.
- Деплой — только по тегу `vX.Y.Z` на коммите из `main` (`.github/workflows/deploy.yml`).
- Выпуск — `bun deploy [patch|minor|major]` из `dev` (`scripts/deploy.ts`), подробно — «Ветки и релизы» в README.md.
- Окружение разработки — `bun dev` (`scripts/dev.ts`): локальный Supabase, никогда не production.

## Данные

- Данные хранятся без клиентского шифрования (Postgres + RLS), см. docs/encryption.md.
- `scripts/reset-user-data.sql` — только ручной запуск, не класть в `supabase/migrations`.
