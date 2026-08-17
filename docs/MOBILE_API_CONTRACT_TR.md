# Lymix Mobil API Sözleşmesi

Base URL build-time `LYMIX_API_BASE` ile verilir. Production istemcisi yalnız HTTPS kullanmalıdır.

## Public/runtime

| Method | Path | Amaç |
|---|---|---|
| GET | `/api/v1/health` | API process sağlık kontrolü |
| GET | `/api/v1/ready` | DB/JWT/OTP readiness |
| GET | `/api/v1/runtime/config` | maintenance, min/latest sürüm ve feature flags |
| POST | `/api/v1/auth/otp/request` | REGISTER/LOGIN/RESET_PASSWORD OTP isteği |
| POST | `/api/v1/auth/register` | telefon + OTP + şifre ile kayıt |
| POST | `/api/v1/auth/login` | kullanıcı adı/telefon + şifre |
| POST | `/api/v1/auth/login/otp` | telefon + OTP ile giriş |
| POST | `/api/v1/auth/refresh` | access/refresh token rotation |
| POST | `/api/v1/auth/password/reset` | OTP ile şifre sıfırlama |

## Authenticated user

Tüm isteklerde `Authorization: Bearer <accessToken>` gerekir.

| Method | Path | Amaç |
|---|---|---|
| POST | `/api/v1/auth/logout` | mevcut session revoke |
| POST | `/api/v1/auth/logout-all` | tüm sessionları kapat |
| POST | `/api/v1/auth/password/change` | mevcut şifreyle değiştir |
| GET | `/api/v1/me` | profil |
| PATCH | `/api/v1/me` | profil güncelle |
| GET | `/api/v1/me/export` | kullanıcı veri exportu |
| DELETE | `/api/v1/me` | hesabı anonimleştir/sil |
| GET | `/api/v1/devices` | cihaz listesi |
| PATCH | `/api/v1/devices/:deviceId/trusted` | cihaz güven durumu |
| GET | `/api/v1/sessions` | aktif session listesi |
| DELETE | `/api/v1/sessions/:sessionId` | tek session revoke |
| GET | `/api/v1/wallet` | coin bakiye |
| GET | `/api/v1/wallet/ledger` | coin hareketleri |

## Agora voice

| Method | Path | Amaç |
|---|---|---|
| GET | `/api/v1/agora/status` | Agora server token config durumu |
| POST | `/api/v1/agora/rtc-token` | `roomId` için kısa ömürlü RTC token |

RTC token response örneği:

```json
{
  "appId": "...",
  "token": "...",
  "channelName": "lymix_ROOM123",
  "userAccount": "DATABASE_USER_ID",
  "expiresInSeconds": 3600
}
```

`AGORA_APP_CERTIFICATE` hiçbir zaman bu response'a veya Flutter'a girmez.

## SUD mobile/server bridge

Legacy SUD server API'leri `/api/games/sud/*`, uygulama DB session kayıtları `/api/v1/games/sud/*` altındadır.

| Method | Path | Amaç |
|---|---|---|
| GET | `/api/games/sud/status` | provider/credential/feature durumu |
| GET | `/api/games/sud/catalog` | oyun kataloğu |
| GET | `/api/games/sud/game/:mgId` | oyun bilgisi |
| POST | `/api/games/sud/get-code` | SDK için kısa süreli code |
| POST | `/api/v1/games/sud/session/join` | Lymix DB game session aç |
| POST | `/api/v1/games/sud/session/leave` | Lymix DB game session kapat |
| POST | `/api/games/sud/events` | allow-list SUD game event |
| GET | `/api/games/sud/reports/room/:roomId` | oda oyun raporları |
| GET | `/api/games/sud/results/:gameRoundId` | player results |

## Admin

Tüm admin endpointleri Bearer JWT + `role=SUPER_ADMIN` ister.

- `/api/v1/admin/metrics`
- `/api/v1/admin/users`
- `/api/v1/admin/users/:userId/status`
- `/api/v1/admin/users/:userId/role`
- `/api/v1/admin/devices/:deviceId/ban`
- `/api/v1/admin/wallet/adjust`
- `/api/v1/admin/audit`
- `/api/v1/admin/sud/orders*`

## İstemci hata politikası

- `400`: form/request hatası; kullanıcıya alan bazlı mesaj.
- `401`: API client bir kez refresh dener; başarısızsa login ekranı.
- `403`: ban/status/yetki problemi.
- `409`: duplicate/insufficient/reuse gibi conflict.
- `429`: cooldown/rate limit; retry süresi göster.
- `503`: provider/config/maintenance/readiness eksik; feature'ı kapat.
- `5xx`: generic hata + retry; hassas backend detayını göstermeme.
