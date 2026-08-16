# Lymix — SUD Server API Coverage

This document tracks the official SUD Server/API and Server/Demo surface reviewed for the Lymix integration.

## Official sources reviewed

- https://docs-gitbook.sud.tech/en-US/app/Server/API/
- https://docs-gitbook.sud.tech/en-US/app/Server/API/CreateOrder.html
- https://docs-gitbook.sud.tech/en-US/app/Server/API/QueryOrder.html
- https://docs-gitbook.sud.tech/en-US/app/Server/API/ObtainServerEndAPIConfigurations.html
- https://docs-gitbook.sud.tech/en-US/app/Server/API/AuthorizationDescription.html
- https://docs-gitbook.sud.tech/en-US/app/Server/API/EntryWithScore/
- https://docs-gitbook.sud.tech/en-US/app/Server/API/EntryWithScore/QueryMatchBase.html
- https://docs-gitbook.sud.tech/en-US/app/Server/API/EntryWithScore/QueryMatchRoundIds.html
- https://docs-gitbook.sud.tech/en-US/app/Server/API/BulletAPI/
- https://docs-gitbook.sud.tech/en-US/app/Server/Demo/
- https://github.com/SudTechnology/hello-sud-node/releases
- https://docs-gitbook.sud.tech/en-US/app/Server/HttpsCallback/CallbackSignatureVerify.html
- https://docs-gitbook.sud.tech/en-US/app/Server/ErrorCode.html

## Shared server infrastructure — implemented

`backend/sud_server_api.js` centralizes:

- API configuration discovery from `https://asc.sudden.ltd/[app_service_signature]`.
- HMAC-MD5 app service signature for discovery.
- Daily API URL caching with refresh-and-retry on failed access.
- `Sud-Auth` HMAC-SHA1 request signing using the exact JSON body.
- Resolution of normal API, match API, cross-app API and bullet API endpoint groups.
- SUD response `ret_code` normalization.

`backend/server.js` also verifies SUD callbacks using the exact raw JSON body and:

- `Sud-AppId`
- `Sud-Timestamp`
- `Sud-Nonce`
- `Sud-Signature`

Timestamp skew and nonce replay protections are added on top of the official signature check.

## Game catalog / reporting — implemented

Lymix routes:

- `GET /api/games/sud/catalog`
- `GET /api/games/sud/game/:mgId`
- `POST /api/games/sud/reports/query`
- `GET /api/games/sud/reports/room/:roomId`
- `GET /api/games/sud/results/:gameRoundId`

Server calls cover game list, game information, game report queries, room report paging and player results.

## Push-event game control — implemented

`POST /api/games/sud/events` uses an allow-list for documented game-service events including user in/out/ready, start/end, captain, kick, settings, AI, room info, quick start, room clear, game create/delete, sub-mode change and batch user entry.

Normal users cannot impersonate another UID for single-user events.

## Create Order / Query Order — implemented with production safety gates

Create order supports the official fields:

- `out_order_id` (required, <=64 chars, merchant-unique)
- `out_group_id` (optional, <=64 chars)
- `mg_id`
- `room_id`
- `cmd`
- `from_uid`
- `to_uid`
- `value` (int32)
- `payload` (optional passthrough object)

Lymix routes:

- `POST /api/games/sud/orders`
- `POST /api/games/sud/orders/batch`
- `GET /api/games/sud/orders/:id?by=out|sud`

Order mutations require both:

- `SUD_ENABLE_ORDER_API=true` / `SUD_ENABLE_BATCH_ORDER_API=true`
- `SUD_LEDGER_READY=true`

The mutation flags default to false. Query order remains available to Baş Admin for reconciliation.

SUD order states recognized by the API contract are `CREATED`, `EXECUTING`, `EXECUTE_FAIL`, and `EXECUTE_SUCCESS`. SUD business errors include duplicate merchant order `70501` and missing order `70503`.

## Per-round currency consumption reporting — implemented, disabled by default

`POST /api/games/sud/round-bill` maps to `report_game_round_bill` and sends:

- `mg_id`
- `room_id`
- `round_id`
- `currency_amount`
- `timestamp`

Enable only after commercial settlement rules are confirmed:

`SUD_ENABLE_ROUND_BILL_API=true`

## Entry with Score — implemented as server-only queries, disabled by default

For entitled products such as Texas Hold'em Pro / TeenPatti Pro:

- `POST /api/games/sud/entry-score/match`
- `POST /api/games/sud/entry-score/round-ids`
- `POST /api/games/sud/entry-score/user-settle`

`query_match_base` and `query_match_round_ids` support either `match_id` or `report_game_info_key`, with `match_id` taking priority when both exist.

Enable only when SUD grants the entitlement:

`SUD_ENABLE_ENTRY_SCORE_API=true`

## Cross-app APIs — wired, disabled by default

- `POST /api/games/sud/cross-app/apps`
- `POST /api/games/sud/cross-app/rooms`

These resolve `auth_app_list` and `auth_room_list` from the SUD discovery config and are Baş Admin-only.

`SUD_ENABLE_CROSS_APP_API=true`

## Matching APIs — wired, disabled by default

- `POST /api/games/sud/matching/create`
- `POST /api/games/sud/matching/cancel`
- `POST /api/games/sud/matching/config`
- `POST /api/games/sud/matching/user`

They resolve `create_match`, `cancel_match`, `query_game_config`, and `query_user_matching` from `match_api`.

`SUD_ENABLE_MATCHING_API=true`

## Bullet-screen APIs — wired, disabled by default

- `POST /api/games/sud/bullet/init`
- `POST /api/games/sud/bullet/command`
- `POST /api/games/sud/bullet/refresh`

They resolve the SUD `bullet_api` group and remain disabled unless the selected SUD game/product uses that service.

`SUD_ENABLE_BULLET_API=true`

## HTTPS callbacks

Already active with signature verification:

- `get_sstoken`
- `update_sstoken`
- `get_user_info`
- `report_game_info`
- `notify`

Registered but deliberately fail-closed until the persistent Lymix game ledger is connected:

- `get_account`
- `get_score`
- `update_score`

SUD's `update_score` contract contains a unique `order_id`; Lymix must deduplicate on that ID before applying any score/coin mutation.

## Demo findings

The SUD Demo page points to the public `SudTechnology/hello-sud-node` release line (v1.0.1/v1.0.2). The demo is useful to validate the overall Node server structure, but current GitBook API contracts take precedence because the public demo is old.

## Environment flags

```text
SUD_APP_ID=
SUD_APP_KEY=
SUD_APP_SECRET=
SUD_APP_SERVER_URL=
SUD_IS_TEST_ENV=true
SUD_API_CONFIG_CACHE_MS=86400000
SUD_VERIFY_CALLBACK_SIGNATURES=true
SUD_CALLBACK_MAX_SKEW_MS=300000

SUD_LEDGER_READY=false
SUD_ENABLE_ORDER_API=false
SUD_ENABLE_BATCH_ORDER_API=false
SUD_ENABLE_ROUND_BILL_API=false
SUD_ENABLE_ENTRY_SCORE_API=false
SUD_ENABLE_CROSS_APP_API=false
SUD_ENABLE_MATCHING_API=false
SUD_ENABLE_BULLET_API=false
```

## Production blockers

Before enabling money/score mutations:

1. Connect a persistent transactional Lymix game ledger (database-backed, not process memory).
2. Enforce a unique key on SUD `order_id` and Lymix `out_order_id`.
3. Record immutable debit/credit entries and before/after balances.
4. Make callbacks idempotent and retry-safe.
5. Add reconciliation jobs that query SUD order/match state after timeout or uncertain responses.
6. Confirm SUD product entitlement and TR/MENA commercial/settlement terms.
7. Run sandbox tests for duplicate order, timeout, retry, callback replay, partial failure and reconciliation.

Until those are complete, the integration intentionally refuses to mutate real Lymix coin/score balances.
