# Разработка

## Локальный запуск

Нужны bun, Node и Docker (или dev-контейнер из `.devcontainer/`).

```sh
bun install
bun dev        # supabase start + rsbuild dev, http://localhost:3000
```

`supabase start` поднимает локальную базу в Docker с миграциями и edge functions; если она уже
запущена, ничего не делает. Адрес и ключ локальной базы — в `.env.local` (`bunx supabase status`).
Studio — http://localhost:54323, письма — http://localhost:54324. Вход локально — по email и паролю.

## Деплой

Фронтенд: workflow `.github/workflows/deploy.yml` деплоит в GitHub Pages по push тега `v*`,
только если коммит тега есть в `main`.

База и функции (проект `vfnpkkzaxsraakeacchg`, нужен `supabase link`):

```sh
bunx supabase db push --linked        # миграции
bunx supabase functions deploy        # edge functions
```

Настройки Supabase Dashboard → Authentication → Sign In / Providers: у Email выключено «Confirm
email»; Google и GitHub включены там же, callback URL —
`https://vfnpkkzaxsraakeacchg.supabase.co/auth/v1/callback`. Разрешённые адреса возврата —
`additional_redirect_urls` в `supabase/config.toml`.
