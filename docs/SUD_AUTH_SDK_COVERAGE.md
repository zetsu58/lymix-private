# Lymix — SUD Authentication / Server SDK Coverage

This document records the SUD authentication, Server SDK, callback and error-code contracts reviewed for the Lymix Node backend.

## Official sources reviewed

- https://docs-gitbook.sud.tech/en-US/app/Server/ImplementAuthenticationByYourself.html
- https://docs-gitbook.sud.tech/en-US/app/Server/SDK/SudMGPAuth-Node.html
- https://docs-gitbook.sud.tech/en-US/app/Server/SDK/SudMGPAuth-Java.html
- https://docs-gitbook.sud.tech/en-US/app/Server/SDK/SudMGPAuth-Go.html
- https://docs-gitbook.sud.tech/en-US/app/Server/SDK/SudMGPAuth-Dotnet.html
- https://docs-gitbook.sud.tech/en-US/app/Server/HttpsCallback/get_sstoken.html
- https://docs-gitbook.sud.tech/en-US/app/Server/HttpsCallback/update_sstoken.html
- https://docs-gitbook.sud.tech/en-US/app/Server/HttpsCallback/get_user_info.html
- https://docs-gitbook.sud.tech/en-US/app/Server/HttpsCallback/CallbackSignatureVerify.html
- https://docs-gitbook.sud.tech/en-US/app/Server/ErrorCode.html
- https://docs-gitbook.sud.tech/en-US/app/Server/Server_Change_Log.html
- https://docs-gitbook.sud.tech/en-US/app/Server/Demo/

## Authentication protocol

SUD defines four logical authentication operations:

1. Login / get short-lived Code — called by the app client through the Lymix backend.
2. get_sstoken — called by the SUD game server using Code.
3. update_sstoken — called by the SUD game server using an SSToken.
4. get_user_info — called by the SUD game server using an SSToken.

All Code and SSToken values are bound to a UID. Lymix binds Code generation to the authenticated Lymix JWT subject, never to a client-supplied UID.

## Official Node SDK surface — implemented

`backend/sud_auth_adapter.js` wraps:

- `NewSudMGPAuth(appId, appSecret)`
- `getCode(uid, expireDuration)`
- `getSSToken(uid, expireDuration)`
- `getUidByCode(code)`
- `getUidBySSToken(ssToken)`
- `verifyCode(code)`
- `verifySSToken(ssToken)`

The package is loaded lazily because `@sudtechnology/sud-mgp-auth-node` requires SUD-granted GitHub Packages access.

## Token duration rules

For the Node SDK:

- Duration unit is milliseconds.
- `0` / omitted duration uses the SDK default of two hours.
- Custom durations below 30 minutes are normalized to at least 30 minutes by the Lymix adapter, matching the Node SDK documentation.

Do not copy TTL assumptions from another language SDK. Cross-language documentation has historically differed in some duration details; the deployed Node backend follows the Node SDK contract.

## UID validation

SUD callback documentation specifies a maximum UID length of 200 bytes. The adapter rejects empty UIDs and UIDs exceeding 200 UTF-8 bytes before token creation.

SUD also recommends using a virtual/hash-based UID when appropriate to avoid exposing an application's real internal identifier. Lymix can add a stable pseudonymous SUD UID mapping when the production user database is connected.

## SDK error codes — normalized and transparently forwarded

The adapter recognizes:

- `0` — success
- `1001` — token creation failed
- `1002` — token verification/signature failed
- `1003` — token parsing failed
- `1004` — invalid token / invalid claims
- `1005` — token expired

SUD requires the `errorCode` returned from UID-resolution methods to be transparently forwarded to the game server when resolution fails. The adapter therefore normalizes SDK `errorCode` into `errorCode`, `sdkErrorCode`, and `sdk_error_code` aliases so the existing callback layer cannot accidentally collapse all failures into token-expired `1005`.

## get_sstoken — implemented

Lymix returns snake_case fields:

- `ret_code`
- `ret_msg`
- `sdk_error_code`
- `data.ss_token`
- `data.expire_date`
- `data.expire_date_str`
- `data.user_info`

`user_info` is included inline so SUD can skip an extra `get_user_info` request when it accepts the supplied profile. `expire_date_str` is retained because SUD specifically documents it for Node.js services.

## update_sstoken — implemented

The callback resolves the UID from the old SSToken, transparently forwards SDK failures, creates a replacement SSToken, and returns snake_case `ss_token` + `expire_date`.

## get_user_info — implemented

The callback resolves the UID from SSToken and returns:

- `uid`
- `nick_name`
- `avatar_url`
- `gender`
- `is_ai`
- `ai_level`

The current Lymix repository still uses a minimal profile resolver. Production must replace it with the real user database and enforce the SUD UID maximum.

## Token verification APIs

`verifyCode` and `verifySSToken` are implemented in the adapter for diagnostics, tests, and internal validation. They are deliberately not exposed as public unauthenticated HTTP routes because tokens are credentials and a public validity oracle is unnecessary.

## Callback signature verification

Lymix verifies the exact callback raw body with:

- `Sud-AppId`
- `Sud-Timestamp`
- `Sud-Nonce`
- `Sud-Signature`

The signature source is four newline-terminated lines:

`appId + "\n" + timestamp + "\n" + nonce + "\n" + rawBody + "\n"`

The HMAC algorithm is SHA-1 with `appSecret`. Lymix additionally checks timestamp skew and re-used nonces to reduce replay risk.

## Compatibility requirement

SUD callback request documents explicitly state that more request fields may be added. Lymix therefore reads only known fields and does not reject callbacks merely because additional JSON fields exist.

## Environment separation

SUD documents separate callback configuration for test and production environments. Production URLs take effect after SUD-side online deployment. Lymix must register HTTPS callback URLs independently for sandbox and production.

## Relevant game-server errors for launch diagnostics

In addition to SDK token errors, operational errors to surface in admin diagnostics include:

- `10003` invalid AppKey
- `10004` invalid AppSecret
- `10005` invalid bundleId/applicationId
- `10101` app does not exist / credentials not generated
- `10102` incomplete app configuration
- `10104` app unauthorized
- `10105` app game entitlement missing
- `10111` game ID invalid or not associated with app
- `10124` game unsupported in region
- `70401` request authentication failed

These should be treated as configuration/entitlement issues rather than retried indefinitely.

## Production checklist

- Obtain SUD appId/appKey/appSecret.
- Obtain GitHub Packages access to `@sudtechnology/sud-mgp-auth-node`.
- Register Android applicationId and iOS bundleId.
- Register separate sandbox and production callback URLs.
- Replace the temporary user profile resolver with the production Lymix user store.
- Decide whether SUD should receive the internal UID or a stable pseudonymous UID.
- Run expiry tests for Code and SSToken and verify exact forwarding of `1002`, `1003`, `1004`, and `1005`.
- Keep callback signature verification enabled in production.
