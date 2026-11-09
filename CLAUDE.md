# Правила проекта

## Ветки

- `main` — прод (Deity). Новые задачи — в тематических ветках от `main` (например, `mvp-v1`).
- `dev` — общий стенд для проверки: тематическую ветку вливают в `dev` и проверяют там. `dev`
  в `main` не вливается никогда; его можно пересоздать от `main`, если накопились конфликты.
- После проверки в `main` вливается сама тематическая ветка, не `dev`. Напрямую в `main` не коммитим.
- Разделы хаба из `dev` (чат, игра, связи, база знаний, таймер) в `main` не попадают.
- Деплой — только по тегу `vX.Y.Z` на коммите из `main` (`.github/workflows/deploy.yml`).
- Выпуск — `bun run deploy [patch|minor|major]` из `main` (`scripts/deploy.ts`), подробно — docs/development.md.
- README.md в `main` описывает прод; общее для веток (запуск, деплой, ветки) — в docs/development.md.
- Окружение разработки — `bun dev` (`scripts/dev.ts`): локальный Supabase, никогда не production.

## Данные

- Данные хранятся без клиентского шифрования (Postgres + RLS), см. docs/encryption.md.
- `scripts/reset-user-data.sql` — только ручной запуск, не класть в `supabase/migrations`.
