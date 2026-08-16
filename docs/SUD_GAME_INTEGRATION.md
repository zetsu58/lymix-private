# Lymix — SUD Game Integration

## Official references

- Flutter Quick Start: https://docs-gitbook.sud.tech/en-US/app/Client/StartUp-Flutter.html
- Android Quick Start: https://github.com/SudTechnology/hello-sud-plus-android/blob/master/project/QuickStart/README_en.md
- Node Server Quick Start: https://docs-gitbook.sud.tech/en-US/app/Server/StartUp-Node.html
- Node Server SDK: https://docs-gitbook.sud.tech/en-US/app/Server/SDK/SudMGPAuth-Node.html
- Server API: https://docs-gitbook.sud.tech/en-US/app/Server/API/
- HTTPS callbacks: https://docs-gitbook.sud.tech/en-US/app/Server/HttpsCallback/
- Server demo: https://docs-gitbook.sud.tech/en-US/app/Server/Demo/
- SUD Console / Contact Us: https://console.sud.tech/
- Contact email: help@sud.tech

Full Server/API coverage and production feature-gate status is tracked in `docs/SUD_SERVER_API_COVERAGE.md`.

## Current integration state

Lymix backend contains the official SUD Node auth adapter, server API discovery/signing layer, game catalog/report/control routes, order/query integration, Entry-with-Score queries, cross-app/matching/bullet adapters and signature-protected callbacks.

Secrets remain backend-only. `SUD_APP_SECRET` and package tokens must never be embedded in Flutter/APK/IPA.

## Required environment variables

```text
SUD_APP_ID=
SUD_APP_KEY=
SUD_APP_SECRET=
SUD_APP_SERVER_URL=https://YOUR_BACKEND_HOST
SUD_IS_TEST_ENV=true
SUD_CODE_TTL_MS=0
SUD_SSTOKEN_TTL_MS=0
SUD_GITHUB_TOKEN=
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

## Authentication flow

1. Authenticated Lymix user selects a game while in a Lymix room.
2. Flutter calls `POST /api/games/sud/get-code` with Lymix JWT.
3. Backend binds the short SUD code to the authenticated Lymix UID using the official Node SDK.
4. Flutter initializes/loads SudGIP with appId, appKey, code, UID, roomId and mgId.
5. SUD calls `get_sstoken`; Lymix validates the short code and returns SSToken.
6. SUD can renew SSToken through `update_sstoken` and resolve profile through `get_user_info`.
7. Invalid/expired SUD token responses use the documented SDK error behavior.

## Callback URLs

Configure the real Lymix production host with:

```text
/api/games/sud/callback/get_sstoken
/api/games/sud/callback/update_sstoken
/api/games/sud/callback/get_user_info
/api/games/sud/callback/report_game_info
/api/games/sud/callback/notify
/api/games/sud/callback/get_account
/api/games/sud/callback/get_score
/api/games/sud/callback/update_score
```

All callback routes are signature-protected when `SUD_VERIFY_CALLBACK_SIGNATURES=true`.

## Money / score safety

Order creation, batch order creation and score/account mutation are not automatically enabled when SUD credentials are added. They require explicit feature flags and a persistent Lymix transaction ledger.

The ledger must provide database-level uniqueness for both SUD `order_id` and Lymix `out_order_id`, immutable debit/credit records, idempotent callbacks and reconciliation after timeout/unknown state.

Until `SUD_LEDGER_READY=true`, money/score mutation paths intentionally fail closed.

## GitHub Packages / Node SDK

Use `backend/.npmrc.sud.example` as a template after SUD grants package access. Never commit the real GitHub Packages token.

```bash
npm install @sudtechnology/sud-mgp-auth-node
```

## Credentials / access to request from SUD

Request or confirm:

- appId / appKey / appSecret
- test + production authorization
- Android applicationId and iOS bundleId binding
- Node package access
- enabled `mgId` list and Standard/Pro entitlement
- callback URLs
- order / Entry-with-Score / matching / bullet / cross-app product entitlements when needed
- TR/MENA commercial and settlement terms

## Security rules

- Keep all SUD secrets server-side.
- Require Lymix authentication for client-facing SUD routes.
- Keep operational and entitlement APIs Baş Admin-only.
- Verify callback signatures using the exact raw request body.
- Enforce callback timestamp and replay/nonce controls.
- Never mutate the primary coin/score balance without persistent idempotency and reconciliation.
