# Lymix — SUD Game Integration

## Official references

- Flutter Quick Start: https://docs-gitbook.sud.tech/en-US/app/Client/StartUp-Flutter.html
- Client/game list: https://docs-gitbook.sud.tech/en-US/app/Client/StartUp.html
- SUD Console / Contact Us: https://console.sud.tech/
- Contact email: help@sud.tech
- Official Flutter demo: https://github.com/SudTechnology/hello-sud-plus-flutter

## Current integration state

Lymix backend now exposes:

- `GET /api/games/sud/status`
- `GET /api/games/sud/contact`
- `POST /api/games/sud/session`

The integration intentionally does not place SUD secrets in Flutter. `SUD_APP_SECRET` stays only on the backend.

## Required environment variables

Configure these on the production backend after SUD allocates the application:

```text
SUD_APP_ID=
SUD_APP_KEY=
SUD_APP_SECRET=
SUD_APP_SERVER_URL=https://YOUR_BACKEND_HOST
```

Never commit real values to GitHub.

## Credentials to request from SUD

Ask SUD to allocate:

- appId
- appKey
- appSecret
- Flutter SDK / QuickStart access
- server auth SDK/package access for the Lymix GitHub/company account
- production authorization for Türkiye and MENA
- enabled game mgId list
- Standard vs Pro SDK entitlement
- settlement / virtual currency rules where applicable

## Flutter client target flow

1. User enters a Lymix voice room.
2. Lymix keeps its own authenticated `userId` and current `roomId`.
3. Game Center selects a SUD `mgId`.
4. Flutter requests `POST /api/games/sud/session` with `roomId` and `mgId` using the Lymix bearer token.
5. Backend generates the SUD short-term code using the official SUD server authentication flow.
6. Flutter initializes `sud_gip_plugin` with the server-issued code and loads the selected game.
7. Users sharing the same Lymix `roomId` are mapped to the same SUD game room as supported by the selected game.

## Flutter dependency

The official SUD Flutter demo uses `sud_gip_plugin` and documents Android/iOS support. Add the dependency only inside the extracted/current Flutter source tree, not into the repository ZIP wrapper.

## Security rules

- Never return `SUD_APP_SECRET` from an API.
- Never embed `appSecret` in Flutter, APK, IPA, assets, or remote config.
- Require an authenticated Lymix user before issuing a game session.
- Validate `roomId`, `mgId`, user authorization, game entitlement, and rate limits server-side.
- Use SUD's official server auth SDK or documented authentication algorithm; do not invent a compatible token format.

## Contact button

The Lymix admin/game integration UI should open:

`GET /api/games/sud/contact`

The backend redirects to the official SUD Console / Contact Us page. This keeps the destination centrally configurable.