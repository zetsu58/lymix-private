# Lymix — SUD Game Integration

## Official references

- Flutter Quick Start: https://docs-gitbook.sud.tech/en-US/app/Client/StartUp-Flutter.html
- Android Quick Start: https://github.com/SudTechnology/hello-sud-plus-android/blob/master/project/QuickStart/README_en.md
- Node Server Quick Start: https://docs-gitbook.sud.tech/en-US/app/Server/StartUp-Node.html
- Node Server SDK: https://docs-gitbook.sud.tech/en-US/app/Server/SDK/SudMGPAuth-Node.html
- Server API: https://docs-gitbook.sud.tech/en-US/app/Server/API/
- HTTPS callbacks: https://docs-gitbook.sud.tech/en-US/app/Server/HttpsCallback/
- Callback signature verification: https://docs-gitbook.sud.tech/en-US/app/Server/HttpsCallback/CallbackSignatureVerify.html
- SUD Console / Contact Us: https://console.sud.tech/
- Contact email: help@sud.tech

## Current integration state

Lymix backend now includes both SUD authentication and the non-wallet server API client.

Authentication / discovery:

- `GET /api/games/sud/status`
- `GET /api/games/sud/contact`
- `POST /api/games/sud/get-code`
- `POST /api/games/sud/session` (legacy 307 alias)
- `GET /api/games/sud/server/config` (Baş Admin only; returns available endpoint names, never URLs/secrets)

Game catalog / reporting:

- `GET /api/games/sud/catalog`
- `GET /api/games/sud/game/:mgId`
- `POST /api/games/sud/reports/query`
- `GET /api/games/sud/reports/room/:roomId`
- `GET /api/games/sud/results/:gameRoundId`

Game-service control:

- `POST /api/games/sud/events`

Callbacks:

- `POST /api/games/sud/callback/get_sstoken`
- `POST /api/games/sud/callback/update_sstoken`
- `POST /api/games/sud/callback/get_user_info`

`backend/sud_auth_adapter.js` wraps SUD's official private Node package `@sudtechnology/sud-mgp-auth-node`.

`backend/sud_server_api.js` implements SUD Server API discovery, request signing, endpoint caching, catalog access, game metadata, reporting/results, game-service event push, and callback signature verification.

## Server API configuration discovery

SUD does not recommend hard-coding individual server API URLs. The backend first creates an app-service signature:

```text
HMAC-MD5(key=appSecret, data=appId)
```

and requests:

```text
https://asc.sudden.ltd/{app_service_signature}
```

The returned configuration contains addresses such as game list, game information, report query, player results and push-event endpoints. Lymix caches the configuration for 24 hours by default. If a SUD API address fails, the client refreshes the configuration once and retries the request.

Environment setting:

```text
SUD_API_CONFIG_CACHE_MS=86400000
```

## SUD Server API Authorization

All supported outgoing SUD Server API POST requests use the official `Sud-Auth` format.

Signature content is four newline-terminated lines:

```text
appId\n
timestamp\n
nonce\n
requestBody\n
```

The signature is:

```text
HMAC-SHA1(key=appSecret, data=signatureContent)
```

and the header is emitted as:

```text
Authorization: Sud-Auth app_id="...",timestamp="...",nonce="...",signature="..."
```

`appSecret` never leaves the backend.

## Game catalog

`GET /api/games/sud/catalog?platform=2` proxies the official new game-list API through Lymix authentication. Android is platform `2`; iOS is `1`; Web is `3`.

The response includes each `mg_id`, localized name/description, thumbnail/loading images and `game_mode_list`, including supported player/team ranges. This data should be cached in the Flutter Game Center rather than hard-coded.

`GET /api/games/sud/game/:mgId` fetches the current metadata for one game.

## Game reports and results

`POST /api/games/sud/reports/query` accepts either:

```json
{
  "gameRoundId": "...",
  "filterTypes": ["game_start", "game_settle"]
}
```

or a `reportGameInfoKey`. SUD documents `game_round_id` as a deduplication identifier. Node code should prefer `mg_id_str` where both numeric and string forms are returned.

`GET /api/games/sud/reports/room/:roomId?pageNo=0&pageSize=10` reads room game reports. SUD currently documents that this paged room-report endpoint stores only 24 hours of data and caps page size at 10.

`GET /api/games/sud/results/:gameRoundId?pageNo=0&pageSize=10` retrieves player results for one game round, including rank, escape state, AI flag and optional score/win/award fields.

## Push events / room control

`POST /api/games/sud/events` signs and forwards only the documented event allow-list:

- `user_in`
- `user_out`
- `user_ready`
- `game_start`
- `captain_change`
- `user_kick`
- `game_end`
- `game_setting`
- `ai_add`
- `room_info`
- `quick_start`
- `room_clear`
- `game_create`
- `game_delete`
- `mode_ex_change`
- `user_in_batch`
- `draw_image_clear`

Request shape:

```json
{
  "event": "user_in",
  "mgId": "1461227817776713818",
  "data": {
    "uid": "LYMIX_USER_ID",
    "room_id": "LYMIX_ROOM_ID",
    "mode": 1,
    "language": "tr-TR",
    "seat_index": -1,
    "is_seat_random": true,
    "team_id": 1
  }
}
```

The backend adds `app_id` and millisecond timestamp automatically and signs the exact JSON body. Normal users cannot submit single-user events while impersonating a different UID; administrative orchestration can be added to the real role/permission model later.

`quick_start` and `room_clear` are powerful room-level operations. UI controls for these should be limited to room owner/admin permissions in the production role system.

## Callback signature verification

Callback verification is enabled by default:

```text
SUD_VERIFY_CALLBACK_SIGNATURES=true
SUD_CALLBACK_MAX_SKEW_MS=300000
```

The backend reads:

```text
Sud-AppId
Sud-Timestamp
Sud-Nonce
Sud-Signature
```

and verifies HMAC-SHA1 over the exact raw HTTP JSON body. It also rejects callbacks outside the configured timestamp window and rejects repeated timestamp+nonce pairs while they remain in the replay window.

This is intentionally stricter than accepting callbacks anonymously. Never disable callback signature verification in production.

## GitHub Packages / Node SDK

SUD distributes its Node server auth SDK from GitHub Packages and access must be granted by SUD.

Use `backend/.npmrc.sud.example` as the template. Never commit the real token.

After SUD grants package access, configure the package token in the deployment environment and install:

```bash
npm install @sudtechnology/sud-mgp-auth-node
```

Do not add the private package to the normal production dependency lock until the deployment environment has working SUD GitHub Packages credentials, otherwise clean CI builds will fail before access is granted.

## Required environment variables

```text
SUD_APP_ID=
SUD_APP_KEY=
SUD_APP_SECRET=
SUD_APP_SERVER_URL=https://YOUR_BACKEND_HOST
SUD_IS_TEST_ENV=true
SUD_CODE_TTL_MS=0
SUD_SSTOKEN_TTL_MS=0
SUD_API_CONFIG_CACHE_MS=86400000
SUD_VERIFY_CALLBACK_SIGNATURES=true
SUD_CALLBACK_MAX_SKEW_MS=300000
SUD_GITHUB_TOKEN=
```

Never commit real credential values to GitHub.

## Authentication flow

1. Authenticated Lymix user selects a game (`mgId`) while in a Lymix room (`roomId`).
2. Flutter calls `POST /api/games/sud/get-code` using the Lymix bearer token.
3. Backend binds the SUD code to the authenticated Lymix `userId` using the official Node SDK.
4. Flutter uses `appId`, `appKey`, `code`, `userId`, `roomId`, `mgId`, and test/production flag to initialize/load SudGIP.
5. SUD game server sends the code to Lymix `get_sstoken` callback.
6. Lymix resolves the UID from the code and generates an SSToken.
7. SUD can renew that SSToken through `update_sstoken` and resolve the player profile through `get_user_info`.
8. Expired/invalid SUD tokens return `sdk_error_code: 1005` as required by SUD.

## Callback URLs to provide to SUD

Assuming the production backend is `https://api.example.com`:

```text
https://api.example.com/api/games/sud/callback/get_sstoken
https://api.example.com/api/games/sud/callback/update_sstoken
https://api.example.com/api/games/sud/callback/get_user_info
```

Replace the host with the actual Lymix production backend host.

## Deliberately not exposed yet

The SUD API section also includes monetary/order and special-mode interfaces such as create order, batch create order, query order, Texas Hold'em/TeenPatti score-entry APIs and bullet-screen APIs.

The generic SUD client knows how to discover those endpoint addresses, but Lymix does **not** expose wallet/order mutation routes yet. These must not touch the main coin balance until the real database has an idempotent ledger with unique transaction IDs, replay protection, reconciliation, audit history and explicit product/licensing rules.

Likewise, bullet-screen and cross-app/cross-match APIs should only be enabled when Lymix has a licensed game/use case that requires them.

## User profile integration

The current repository still contains a minimal single-admin authentication backend. `get_user_info` therefore has a temporary profile resolver. Before production launch this must be replaced with the real Lymix user database so SUD receives the real nickname/avatar/gender for each authenticated UID.

## Credentials / access to request from SUD

Ask SUD to allocate or enable:

- appId
- appKey
- appSecret
- test environment authorization
- production environment authorization for Türkiye/MENA
- Lymix Android applicationId / iOS bundleId binding
- GitHub Packages access for `@sudtechnology/sud-mgp-auth-node`
- server demo/repository access for the Lymix GitHub/company account
- enabled game `mgId` list
- Standard vs Pro entitlement
- settlement / virtual-currency rules where applicable

## Security rules

- Never return `SUD_APP_SECRET` from an API.
- Never embed `appSecret` or the SUD GitHub token in Flutter, APK, IPA, assets, or remote config.
- Require an authenticated Lymix user before issuing a SUD game code or calling server APIs.
- Validate room membership, room role/permission, `mgId`, game entitlement and requested event server-side before production.
- Keep callback endpoints HTTPS-only.
- Keep callback signature verification enabled.
- Do not enable score/account/order mutations before the idempotent ledger is complete.

## Contact button

The Lymix admin/game integration UI can open:

`GET /api/games/sud/contact`

The backend redirects to the official SUD Console / Contact Us page.
