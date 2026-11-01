# Iframe API монеток

Раздел «Игра» (`/game`) показывает игру из `project-25` в iframe по адресу из `PUBLIC_WORLD_URL`.
Приложение даёт игре только API монеток: сообщает баланс и списывает монетки по её запросу.
Всё остальное — что покупается, цены, состояние мира — хранит и решает сама игра. Игра не ходит
в сеть: обмен идёт через `window.postMessage`, списание на сервере делает приложение.

Типы сообщений — `src/lib/world/protocol.ts`, версия протокола — `1`.

## Безопасность

- Приложение принимает сообщения только от окна своего iframe и только с origin из `PUBLIC_WORLD_URL`.
- Игра должна принимать сообщения только от `window.parent` и проверять `event.origin`
  (адрес приложения: `https://rykov-dev.github.io` в проде, `http://localhost:3000` локально).
- Обе стороны отправляют сообщения с явным `targetOrigin`, а не `'*'`.

## Игра → приложение

```ts
// Игра загрузилась и готова получить баланс. Можно слать повторно (например, после перезапуска).
{ type: 'world:ready', version: 1 }

// Списать монетки. amount — целое > 0; description — что покупается (до 200 символов),
// видно в истории монеток; requestId — уникальная строка до 100 символов.
{ type: 'world:spend', requestId: string, amount: number, description: string }
```

Повтор запроса с тем же `requestId` второй раз не списывает — например, если ответ потерялся.

## Приложение → игра

```ts
// Баланс: после каждого 'world:ready' и после любого изменения.
{ type: 'monetki:coins', version: 1, coins: number, canSpend: boolean } // canSpend: false офлайн

// Ответ на 'world:spend'. При успехе — новый баланс; покупку игра применяет только после ok: true.
{ type: 'monetki:result', requestId: string, ok: true, coins: number }
{ type: 'monetki:result', requestId: string, ok: false,
  error: 'not_enough_coins' | 'invalid_amount' | 'offline' | 'failed' }
```
