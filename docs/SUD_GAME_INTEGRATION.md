# Lymix — SUD Game Integration

## Official references

- Flutter Quick Start: https://docs-gitbook.sud.tech/en-US/app/Client/StartUp-Flutter.html
- Android Quick Start: https://github.com/SudTechnology/hello-sud-plus-android/blob/master/project/QuickStart/README_en.md
- Node Server Quick Start: https://docs-gitbook.sud.tech/en-US/app/Server/StartUp-Node.html
- Node Server SDK: https://docs-gitbook.sud.tech/en-US/app/Server/SDK/SudMGPAuth-Node.html
- HTTPS callbacks: https://docs-gitbook.sud.tech/en-US/app/Server/HttpsCallback/
- SUD Console / Contact Us: https://console.sud.tech/
- Contact email: help@sud.tech

## Current integration state

Lymix backend now exposes:

- `GET /api/games/sud/status`
- `GET /api/games/sud/contact`
- `POST /api/games/sud/get-code`
- `POST /api/games/sud/session` (legacy alias)
- `POST /api/games/sud/callback/get_sstoken`
- `POST /api/games/sud/callback/update_sstoken`
- `POST /api/games/sud/callback/get_user_info`

`backend/sud_auth_adapter.js` is a thin adapter around SUD's official Node package `@sudtechnology/sud-mgp-auth-node` and uses the documented `NewSudMGPAuth`, `getCode`, `getSSToken`, `getUidByCode`, and `getUidBySSToken` APIs.

The integration intentionally does not place SUD secrets in Flutter. `SUD_APP_SECRET` stays only on the backend.

## GitHub Packages / Node SDK

SUD distributes its Node server SDK from GitHub Packages and access must be granted by SUD.

Use `backend/.npmrc.sud.example` as the template. Never commit the real token.

After SUD grants package access, configure the package token in the deployment environment and install:

```bash
npm install @sudtechnology/sud-mgp-auth-node
```

Do not add the private package to the normal production dependency lock until the deployment environment has working SUD GitHub Packages credentials, otherwise clean CI builds will fail before the access is granted.

## Required environment variables

Configure these on the backend after SUD allocates the application:

```text
SUD_APP_ID=
SUD_APP_KEY=
SUD_APP_SECRET=
SUD_APP_SERVER_URL=https://YOUR_BACKEND_HOST
SUD_IS_TEST_ENV=true
SUD_CODE_TTL_MS=0
SUD_SSTOKEN_TTL_MS=0
SUD_GITHUB_TOKEN=
```

`0` for token TTL means use the SDK default duration.

Never commit real credential values to GitHub.

## Authentication flow

1. Authenticated Lymix user selects a game (`mgId`) while in a Lymix room (`roomId`).
2. Flutter calls `POST /api/games/sud/get-code` using the Lymix bearer token.
3. Backend binds the SUD code to the authenticated Lymix `userId` using the official Node SDK.
4. Flutter uses `appId`, `appKey`, `code`, `userId`, `roomId`, `mgId`, and the configured test/production flag to initialize/load SudGIP.
5. SUD game server sends the code to Lymix `get_sstoken` callback.
6. Lymix resolves the UID from the code and generates an SSToken.
7. SUD can renew that SSToken through `update_sstoken` and resolve the player profile through `get_user_info`.
8. Expired/invalid SUD tokens return `sdk_error_code: 1005` as required by SUD.

## Callback URLs to provide to SUD

Assuming the production backend is `https://api.example.com`, configure SUD with:

```text
https://api.example.com/api/games/sud/callback/get_sstoken
https://api.example.com/api/games/sud/callback/update_sstoken
https://api.example.com/api/games/sud/callback/get_user_info
```

Replace the host with the actual Lymix production backend host.

## User profile integration

The current repository still contains a minimal single-admin authentication backend. `get_user_info` therefore has a temporary profile resolver. Before production launch this must be replaced with the real Lymix user database so SUD receives the real nickname/avatar/gender for each authenticated UID.

## Required next server callbacks

The SUD server documentation additionally exposes business callbacks such as:

- `report_game_info`
- `get_account`
- `update_score`
- `notify`

Do not connect `get_account` or `update_score` directly to the primary Lymix coin balance. Add an idempotent game ledger/transaction layer first so duplicate callbacks, replay attempts, settlement reconciliation, and audit history are safe.

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
- Require an authenticated Lymix user before issuing a SUD game code.
- Validate `roomId`, `mgId`, user authorization, and game entitlement server-side before production.
- Return SUD callback bodies in the documented snake_case schema.
- Keep callback endpoints HTTPS-only in production.
- Add SUD callback signature verification to settlement/economy callbacks before enabling wallet mutations.

## Contact button

The Lymix admin/game integration UI can open:

`GET /api/games/sud/contact`

The backend redirects to the official SUD Console / Contact Us page.