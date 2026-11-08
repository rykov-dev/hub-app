# Правила проекта

## Ветки

- `dev` — разработка. Все правки и изменения делаются только в `dev`.
- `main` — прод (Deity, только Inbox и серии). В неё только merge из `dev`; напрямую в `main`
  не коммитим. Разделы хаба (чат, игра, связи, база знаний, таймер) в `main` при merge не возвращать.
- Деплой — только по тегу `vX.Y.Z` на коммите из `main` (`.github/workflows/deploy.yml`).
- Выпуск — `bun run deploy [patch|minor|major]` из `dev` (`scripts/deploy.ts`), подробно — docs/development.md.
- README.md в `main` описывает прод и свой; общее для веток (запуск, деплой, ветки) — в docs/development.md.
- Окружение разработки — `bun dev` (`scripts/dev.ts`): локальный Supabase, никогда не production.

## Данные

- Данные хранятся без клиентского шифрования (Postgres + RLS), см. docs/encryption.md.
- `scripts/reset-user-data.sql` — только ручной запуск, не класть в `supabase/migrations`.
