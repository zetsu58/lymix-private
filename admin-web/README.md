# Lymix Baş Admin Console

The admin console is a dependency-free static frontend served by the production backend at `/admin`.

It connects to the production `/api/v1` endpoints and currently supports:

- SUPER_ADMIN login with rotating refresh sessions
- live backend/user/session/game/ledger metrics
- user search
- user status (ACTIVE/SUSPENDED/BANNED)
- role assignment
- idempotent wallet CREDIT/DEBIT adjustments
- SUD order listing and reconciliation
- audit-log viewing

## Production setup

1. Configure PostgreSQL and run `npm run prisma:migrate:deploy`.
2. Seed the real SUPER_ADMIN with `npm run admin:seed`.
3. Configure strong `JWT_SECRET` and `OTP_PEPPER` values.
4. Start the backend with `npm start`.
5. Open `https://YOUR_BACKEND_HOST/admin/`.

The admin page is served on the same origin as the API. It does not embed SUD secrets and never receives `SUD_APP_SECRET`.

The refresh token is stored only in browser `sessionStorage`; closing the browser session clears it. Access tokens are held in memory and rotated through the backend refresh flow.
