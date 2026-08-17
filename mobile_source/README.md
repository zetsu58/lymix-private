# Lymix extracted Flutter source integration

Source snapshot: `LYMIX_V21_22_1_EXTRACTED_FLUTTER_SOURCE.zip` (Codemagic successful export, 2026-08-17).

This directory contains production-ready replacements prepared against the real extracted Flutter source. On the PC merge these paths over the matching `lib/` files, then run `flutter analyze` and tests.

Completed here:
- Production `/api/v1` auth contract.
- Phone + REGISTER OTP flow.
- Secure access/rotating refresh token persistence.
- Backend response parsing for `username`, nested `profile`, `sessionId`.

Next mobile wiring after these files are applied:
1. automatic 401 refresh/retry in ApiClient;
2. sessions/device UI -> `/api/v1/sessions`, `/api/v1/devices`;
3. wallet -> `/api/v1/wallet` and `/api/v1/wallet/ledger`;
4. Agora room engine -> `/api/v1/agora/rtc-token`;
5. SUD Game Center -> authenticated SUD catalog/code/session APIs;
6. final Android/iOS QA.

Do not place provider secrets in Flutter. SUD appSecret and Agora App Certificate remain server-side only.
