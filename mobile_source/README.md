# Extracted Flutter source integration
Real source snapshot received from successful Codemagic export on 2026-08-17. This directory contains replacements mapped to the actual Lymix Flutter files.

Ready: production `/api/v1` auth, phone REGISTER OTP, `deviceKey`, secure rotating refresh token/session storage, nested profile parsing.

Next: apply over real `lib/`, add automatic 401 refresh/retry, wire sessions/devices and wallet, then Agora `/api/v1/agora/rtc-token` and SUD Game Center. Provider secrets stay server-side.
