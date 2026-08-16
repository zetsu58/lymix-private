# Lymix — SUD Authentication / Server SDK Coverage

Official sources reviewed:
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

## Implemented Node SDK surface

`backend/sud_auth_adapter.js` wraps:
- `NewSudMGPAuth(appId, appSecret)`
- `getCode(uid, expireDuration)`
- `getSSToken(uid, expireDuration)`
- `getUidByCode(code)`
- `getUidBySSToken(ssToken)`
- `verifyCode(code)`
- `verifySSToken(ssToken)`

## Authentication contract

Lymix implements the SUD four-operation flow: client login/get-Code, `get_sstoken`, `update_sstoken`, and `get_user_info`. Code and SSToken are always bound to the authenticated Lymix UID.

For Node, token durations are milliseconds; 0 uses the SDK default two hours and custom values below 30 minutes are normalized to 30 minutes. UID input is limited to 200 UTF-8 bytes.

## SDK errors

The adapter normalizes and preserves SUD SDK errors:
- 0 success
- 1001 token creation failed
- 1002 token verification/signature failed
- 1003 token parsing failed
- 1004 invalid token/claims
- 1005 token expired

`getUidByCode` and `getUidBySSToken` results expose `errorCode`, `sdkErrorCode`, and `sdk_error_code` aliases so callbacks transparently return the SDK failure code instead of collapsing all errors to 1005.

## Callback schema

`get_sstoken` returns snake_case `ret_code`, `ret_msg`, `sdk_error_code`, `ss_token`, `expire_date`, `expire_date_str`, and inline `user_info`. Inline user information allows SUD to skip an additional `get_user_info` request.

`update_sstoken` resolves the old SSToken to UID and issues a replacement token. `get_user_info` resolves SSToken to UID and returns `uid`, `nick_name`, `avatar_url`, `gender`, `is_ai`, and `ai_level`.

SUD states that callback requests may gain additional fields; Lymix reads known fields without rejecting unknown JSON properties.

## Callback signature verification

The existing Lymix callback verifier uses exact raw JSON body with `Sud-AppId`, `Sud-Timestamp`, `Sud-Nonce`, and `Sud-Signature`. The four newline-terminated values are HMAC-SHA1 signed with appSecret. Timestamp-skew and nonce replay checks are additional Lymix hardening.

## Environment separation

SUD requires test and production callback URLs to be configured separately. Production URLs become active after SUD online deployment/approval.

## Launch diagnostics

Relevant SUD configuration/entitlement errors include invalid AppKey/AppSecret/applicationId, missing app configuration, unauthorized app, missing game entitlement, invalid game ID, unsupported region, and request-authentication failure. These should be surfaced to admin diagnostics instead of retried indefinitely.

## Production checklist

- Obtain appId/appKey/appSecret.
- Obtain `@sudtechnology/sud-mgp-auth-node` package access.
- Register Android applicationId and iOS bundleId.
- Register sandbox and production callback URLs separately.
- Replace temporary user profile data with the production Lymix user store.
- Decide whether SUD receives an internal UID or a stable pseudonymous UID.
- Test SDK errors 1002/1003/1004/1005 end-to-end.
- Keep callback signature verification enabled in production.
