# Lymix Flutter Integration Template

Bu klasör, ZIP içindeki gerçek Flutter kaynakları GitHub'a normal klasör olarak çıkarılana kadar hazırlanmış entegrasyon katmanıdır. Kaynak export tamamlandığında buradaki dosyalar mevcut proje yapısına uyarlanarak `lib/` altına taşınacaktır.

## Mevcut bağımlılıklar

Lymix bundle'ında zaten doğrulanmış bağımlılıklar:

- `agora_rtc_engine: 6.5.4`
- `flutter_secure_storage: 9.2.2`
- `http: 1.6.0`

SUD erişimi açıldığında eklenecek resmi Flutter plugin:

- `sud_gip_plugin: ^0.0.1`

Sürüm SUD erişimi/entegrasyon paketi geldiğinde tekrar pinlenmelidir.

## Dosyalar

- `config/lymix_environment.dart`: `--dart-define=LYMIX_API_BASE=...`
- `core/api/lymix_api_client.dart`: secure token storage + tek seferlik 401 refresh/retry
- `features/auth/lymix_auth_repository.dart`: register, OTP, login, profile, session/device
- `features/wallet/lymix_wallet_repository.dart`: bakiye ve ledger
- `features/privacy/lymix_privacy_repository.dart`: veri export/hap silme
- `features/voice/lymix_agora_repository.dart`: backend Agora token
- `features/voice/lymix_voice_room_engine.dart`: Agora engine lifecycle/join/leave/mute
- `features/sud/lymix_sud_repository.dart`: katalog/code/session/event/report
- `features/sud/lymix_sud_game_host.dart`: PlatformView + SUD lifecycle + code renewal

## Güvenlik kuralları

- `JWT_SECRET`, `OTP_PEPPER`, `AGORA_APP_CERTIFICATE`, `SUD_APP_SECRET` Flutter'a girmez.
- Flutter sadece kısa ömürlü access/refresh session tokenlarını `flutter_secure_storage` içinde tutar.
- Agora room channel ve user account backend tarafından belirlenir.
- SUD code backend tarafından üretilir; `appSecret` istemciye dönmez.
- Finansal SUD özellikleri `SUD_LEDGER_READY=true` olmadan açılmaz.

## Build örnekleri

Yerel Android:

```bash
flutter run --dart-define=LYMIX_API_BASE=http://192.168.1.10:3000
```

Staging:

```bash
flutter build apk --debug \
  --dart-define=LYMIX_API_BASE=https://STAGING_HOST
```

Production:

```bash
flutter build appbundle --release \
  --dart-define=LYMIX_API_BASE=https://api.lymix.example
```

## Uygulama sırası

1. Gerçek kaynakta mevcut API/base-url servislerini tespit et.
2. Tek bir `LymixApiClient` instance oluştur.
3. Login ekranını `LymixAuthRepository.loginWithPassword` ile bağla.
4. Register + OTP ekranlarını bağla.
5. Splash'ta `/api/v1/runtime/config` al; maintenance/min-version uygulamasını bağla.
6. Profile/wallet/session/device ekranlarını gerçek API'ye geçir.
7. Voice room girişinde `LymixVoiceRoomEngine.join(roomId)` kullan.
8. Game Center katalogdan SUD oyunlarını yükle.
9. Oda içi oyun açarken `LymixSudGameHost(roomId, mgId, ...)` kullan.
10. Analyzer + widget test + gerçek cihaz testi yap.
