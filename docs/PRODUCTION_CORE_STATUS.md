# Lymix Production Core Status

## Implemented in this branch

- PostgreSQL/Prisma user database model
- User profile model and API
- Phone OTP challenge persistence and verification
- Password hashing with bcrypt
- JWT access tokens
- Rotating database-backed refresh sessions
- Device tracking and device-ban enforcement
- Session revoke / revoke-all
- Wallet and immutable ledger entries
- Idempotency keys for balance mutations
- Serializable wallet updates with optimistic version guard
- Ledger reversals
- SUD account/score settlement bridge
- SUD duplicate order (9001) and insufficient balance (9000) handling
- Real SUD user profile resolution from Prisma
- SUD room/game session persistence model
- Production environment template
- Backend bootstrap that keeps the existing SUD gateway intact

## REST API mounted under `/api/v1`

- `POST /auth/otp/request`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/logout-all`
- `GET /me`
- `PATCH /me`
- `GET /devices`
- `GET /wallet`
- `GET /wallet/ledger`
- `POST /admin/wallet/adjust` (SUPER_ADMIN)

## External configuration still required

- Production PostgreSQL `DATABASE_URL`
- Real SMS provider webhook/token
- Long random `JWT_SECRET` and separate `OTP_PEPPER`
- SUD `appId/appKey/appSecret` and package access
- SUD callback registration and product entitlements

## Flutter limitation in current repository

The Flutter application currently exists as `LYMIX_V21_22_1_CODEMAGIC_GITHUB_BUNDLE.zip` rather than unpacked source directories. Safe source-level Flutter edits for registration UI, Game Center, room-game flow and final UI polishing require the Flutter project to be unpacked into the repository (for example `lib/`, `android/`, `ios/`, `pubspec.yaml`).
