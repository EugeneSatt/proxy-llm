<<<<<<< HEAD
# proxy-veo — Vertex AI (Veo) thin proxy (Railway EU/US)

Тонкий прокси-сервис для вызова **Google Vertex AI (Veo)** из региона EU/US (например, Railway).
Сервис **НЕ хранит** `VERTEX_ACCESS_TOKEN`: токен приходит **в каждом запросе** в заголовке `Authorization: Bearer ...`.

## Зачем это нужно

* Упростить интеграцию с Vertex AI Veo, когда твоё приложение работает из региона, где прямой доступ ограничен.
* Вынести вызов Veo в отдельный сервис с минимальной логикой и защитой.

> Proxy — это “труба”: принимает JSON → проксирует в Vertex → возвращает ответ.

---

## Возможности

* `POST /veo/generate` — проксирование запроса в Vertex AI Veo `:predict`
* `GET /health` — healthcheck
* Защита по `x-api-key`
* Проброс `Authorization: Bearer <VERTEX_ACCESS_TOKEN>` (токен приходит с запросом)
* Rate limit (по IP или по ключу)
* Таймаут + 1 retry на 429/5xx
* Не логирует чувствительные данные (headers/body)

---

## Требования

* Node.js 20+
* Доступ к internet из Railway
* В твоём основном проекте/сервисе должен быть механизм получения **Vertex access token** (OAuth / Service Account / внешний сервис)

---

## Установка и запуск локально

### 1) Установить зависимости

```bash
npm i
```

### 2) Создать `.env`

Скопируй шаблон и заполни:

```bash
cp .env.example .env
```

### 3) Запуск в dev

```bash
npm run dev
```

### 4) Production build + start

```bash
npm run build
npm run start
```

---

## Переменные окружения

Смотри `.env.example`:

* `PORT` — порт сервиса (Railway задаёт сам, обычно можно не трогать)
* `PROXY_API_KEY` — секрет для защиты proxy (клиент должен отправлять `x-api-key`)
* `GCP_PROJECT_ID` — ID проекта в Google Cloud
* `GCP_LOCATION` — location Vertex AI (например `us-central1`)
* `VEO_MODEL_ID` — модель Veo (например `veo-3.0-generate`)
* `REQUEST_TIMEOUT_MS` — таймаут запроса к Vertex (рекомендуется 60000)
* `RATE_LIMIT_PER_MINUTE` — лимит запросов в минуту (например 30)
* `LOG_LEVEL` — уровень логирования

---

## API

### Healthcheck

`GET /health`

Ответ:

```json
{ "ok": true }
```

### Veo predict proxy

`POST /veo/generate`

**Обязательные заголовки:**

* `x-api-key: <PROXY_API_KEY>`
* `Authorization: Bearer <VERTEX_ACCESS_TOKEN>`
* `Content-Type: application/json`

**Тело запроса:**
Любой валидный JSON — проксируется 1:1 в Vertex.

**Ответ:**

* статус и тело ответа Vertex возвращаются без изменений (pass-through)

---

## Как формируется Vertex endpoint

Proxy обращается по адресу:

```
https://{GCP_LOCATION}-aiplatform.googleapis.com/v1
/projects/{GCP_PROJECT_ID}/locations/{GCP_LOCATION}
/publishers/google/models/{VEO_MODEL_ID}:predict
```

---

## Пример запроса (curl)

> ⚠️ `VERTEX_ACCESS_TOKEN` — короткоживущий токен. Получай его в своём основном сервисе и передавай сюда.

```bash
curl -X POST "http://localhost:3000/veo/generate" \
  -H "Content-Type: application/json" \
  -H "x-api-key: super-secret" \
  -H "Authorization: Bearer YOUR_VERTEX_ACCESS_TOKEN" \
  -d '{
    "instances": [
      {
        "prompt": "A man talking inside a car, cinematic, realistic",
        "image": { "uri": "https://example.com/input.jpg" }
      }
    ],
    "parameters": {
      "durationSeconds": 6
    }
  }'
```

---

## Деплой на Railway

### 1) Создай проект

* Railway → New Project → Deploy from GitHub
* Выбери репозиторий `proxy-veo`

### 2) Выбери регион (важно)

* Выбирай **EU** или **US** (в зависимости от того, где Vertex/модель доступнее и что тебе нужно)

### 3) Добавь переменные окружения

Railway → Variables:

* `PROXY_API_KEY`
* `GCP_PROJECT_ID`
* `GCP_LOCATION`
* `VEO_MODEL_ID`
* `REQUEST_TIMEOUT_MS`
* `RATE_LIMIT_PER_MINUTE`
* `LOG_LEVEL`

`PORT` Railway выставит автоматически.

### 4) Запуск

Railway сам выполнит build и start согласно `package.json`.

---

## Безопасность (рекомендации)

* **Никогда** не делай `PROXY_API_KEY` публичным.
* Не логируй `Authorization` и тело запроса (промт/картинку).
* При необходимости добавь:

  * IP allowlist
  * HMAC подпись вместо простого `x-api-key`
  * более жёсткий rate-limit
* Не делай endpoint доступным из браузера (CORS выключен/закрыт).

---

## Частые ошибки

* **401 unauthorized proxy access** — неверный/отсутствующий `x-api-key`
* **400 missing vertex access token** — нет `Authorization: Bearer ...`
* **502** — таймаут или сетевой сбой при запросе к Vertex
* **403/404 от Vertex** — неверный project/location/modelId или нет доступа к модели Veo в твоём GCP аккаунте

---

## Лицензия

MIT (по желанию)

---

Если захочешь, можно расширить proxy:

* несколько роутов под разные модели (Imagen/Veo)
* кеширование результатов (обычно не надо)
* подпись запросов HMAC
=======
# proxy-veo

Тонкий прокси к Google Vertex AI (Veo) на Fastify. Не хранит Vertex access token — проксирует его из каждого запроса. Готов к деплою на Railway (EU/US).

## Стек
- Node.js 20+, TypeScript
- Fastify + helmet + rate limit
- Pino-логирование с редактированием чувствительных заголовков
- 1 retry на 5xx/429 с джиттером, таймаут запроса к Vertex по `REQUEST_TIMEOUT_MS`

## Быстрый старт локально
1. Скопируйте `.env.example` в `.env` и заполните значения.
2. Установите зависимости:
   ```bash
   npm install
   ```
3. Запуск в dev-режиме с авто-ребилдом:
   ```bash
   npm run dev
   ```
4. Продакшн-сборка и запуск:
   ```bash
   npm run build
   npm start
   ```

## Переменные окружения
- `PORT` — порт сервера (по умолчанию 3000)
- `PROXY_API_KEY` — секрет для заголовка `x-api-key`
- `GCP_PROJECT_ID` — ваш GCP проект
- `GCP_LOCATION` — регион Vertex (например, `us-central1`, `europe-west4`)
- `VEO_MODEL_ID` — модель Veo (например, `veo-3.0-generate`)
- `REQUEST_TIMEOUT_MS` — таймаут запроса к Vertex, мс (по умолчанию 60000)
- `RATE_LIMIT_PER_MINUTE` — лимит запросов в минуту (по умолчанию 30)
- `LOG_LEVEL` — уровень логирования Pino (`info`, `warn`, `error`, ...)

## API
- `GET /health` → `{ "ok": true }`
- `POST /veo/generate`
  - Заголовки: `x-api-key` (обязательно), `Authorization: Bearer <VERTEX_ACCESS_TOKEN>` (обязательно), `Content-Type: application/json`
  - Тело: любой JSON, проксируется 1:1 в Vertex
  - Ответ: статус и тело Vertex без изменений (если Vertex вернул не-JSON — отдаётся текст с тем же статусом)

## Пример запроса
```bash
curl -X POST http://localhost:3000/veo/generate \
  -H "x-api-key: super-secret" \
  -H "Authorization: Bearer ${VERTEX_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "instances": [
      {
        "prompt": "A calm sunset over mountains",
        "image": {
          "mimeType": "image/png",
          "gcsUri": "gs://your-bucket/sample.png"
        }
      }
    ]
  }'
```

## Деплой на Railway
1. Создайте новый проект на Railway и выберите регион, близкий к `GCP_LOCATION` (например, Railway EU ⇔ `europe-west4`, Railway US ⇔ `us-central1`).
2. Подключите репозиторий или загрузите папку `proxy-veo/`.
3. В переменные окружения Railway добавьте значения из `.env.example` (`PROXY_API_KEY`, `GCP_PROJECT_ID`, `GCP_LOCATION`, `VEO_MODEL_ID`, `REQUEST_TIMEOUT_MS`, `RATE_LIMIT_PER_MINUTE`, `LOG_LEVEL`).
4. Стартовая команда по умолчанию: `npm run start` (Railway установит зависимости и выполнит сборку `npm run build`).
5. Убедитесь, что сервис слушает `0.0.0.0:$PORT` (конфиг по умолчанию уже так и делает).

## Поведение и безопасность
- CORS выключен (никаких публичных браузерных вызовов).
- Лимит тела JSON: 20mb.
- Проверка `x-api-key` и `Authorization: Bearer ...` на каждом запросе.
- Rate limit: `RATE_LIMIT_PER_MINUTE` на IP или `x-api-key`.
- Логирование не включает `Authorization`, `x-api-key` и тело запроса/ответа.
>>>>>>> 79177ac (init project)
