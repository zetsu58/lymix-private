# Lymix PC / VS Code Handoff Checklist

Amaç: PC açıldığında yeniden mimari kurmak yerine kaynakları bağlamak, derlemek ve test etmek.

## 1. Repo

```bash
git clone https://github.com/zetsu58/lymix-private.git
cd lymix-private
git pull
```

Flutter source-export artifact başarıyla alındıysa gerçek Flutter projeyi ZIP'ten normal klasöre çıkar ve ayrı branch aç.

## 2. Backend en hızlı yol

Docker Desktop varsa:

```bash
docker compose -f docker-compose.dev.yml up --build
```

Kontrol:

```text
http://localhost:3000/api/v1/health
http://localhost:3000/api/v1/ready
http://localhost:3000/api/v1/runtime/config
http://localhost:3000/admin/
```

Docker istemiyorsan PostgreSQL 15+ + Node 20 kullan; `backend/.env.staging.example` üzerinden local `.env` oluştur.

## 3. Backend kalite kontrol

```bash
cd backend
npm install --no-audit --no-fund
npm run prisma:validate
npm run test:unit
npm run runtime:validate
npm run smoke:http
```

Admin test hesabı yaratılacaksa gerçek local secretlar `.env` içinde tutulur ve repo'ya commit edilmez.

## 4. Flutter toolchain

- Flutter: mevcut Codemagic ile aynı sürüm: `3.44.7`
- Java: 17
- Android compileSdk: 36
- `flutter doctor -v`
- `flutter pub get`
- `flutter analyze`

## 5. Flutter template taşıma

`flutter_integration_template/lib/` altındaki dosyaları gerçek uygulama mimarisine uyarlayıp `lib/` altına taşı:

1. `LymixEnvironment`
2. `LymixApiClient`
3. `LymixAuthRepository`
4. `LymixWalletRepository`
5. `LymixPrivacyRepository`
6. `LymixAgoraRepository`
7. `LymixVoiceRoomEngine`
8. `LymixSudRepository`
9. `LymixSudGameHost`

Mevcut servislerle aynı görevi yapan dosyalar varsa duplicate yaratmak yerine içeriklerini birleştir.

## 6. Auth UI

- Login mevcut backend `/api/v1/auth/login` ile değiştir.
- `Kayıt Ol` butonu ve ekranı ekle.
- Telefon + OTP request + OTP verify/register akışı.
- Forgot Password → OTP → password reset.
- 401 refresh/retry `LymixApiClient` tarafından yönetilsin.
- Başarılı login sonrası `/api/v1/me` ile gerçek profile state yükle.

## 7. Splash/runtime config

Splash sırasında `/api/v1/runtime/config`:

- maintenance ise maintenance ekranı,
- mevcut app sürümü minimumdan düşükse force-update ekranı,
- `agoraVoice=false` ise ses odası bağlantısını kontrollü kapat,
- `sudGames=false` ise Game Center'da "yakında" durumu göster.

## 8. Voice room

Odaya girerken:

1. Mikrofon izni.
2. `LymixVoiceRoomEngine.join(roomId)`.
3. Backend `/api/v1/agora/rtc-token` token üretir.
4. Agora user account = JWT user id.
5. UI mic/speaker butonlarını engine'e bağla.
6. Oda çıkışında `leave()`.

Agora App Certificate Flutter'a eklenmez.

## 9. SUD Game Center

SUD credential gelmeden UI/flow hazırlanabilir; gerçek oyun yalnız feature hazırsa açılır.

1. `/api/games/sud/catalog` → oyun listesi.
2. Seçilen `mgId` + voice-room `roomId`.
3. `LymixSudGameHost` aç.
4. Backend code → `initSDK` → `loadGame`.
5. `onExpireCode` → backend → `updateCode`.
6. Exit → leave-session + destroy/dispose.

## 10. Android test

- Analyzer 0 error.
- Debug APK.
- Gerçek cihaz login/register/profile/wallet.
- Voice 2 cihaz testi.
- Game Center empty/credential-missing state testi.
- SUD sandbox gelince 2+ kullanıcı aynı roomId testi.
- Firebase Test Lab matrisi tekrar.

## 11. iOS

- Xcode signing/bundle id.
- Microphone/camera usage descriptions.
- Agora/SUD iOS native dependency kontrolü.
- TestFlight gerçek cihaz testi.

## 12. Store öncesi

- `ALLOW_DEV_OTP=false`
- gerçek SMS provider
- production PostgreSQL + backup
- HTTPS
- güçlü JWT/OTP secrets
- Agora Certificate server-side
- SUD callback signature verification true
- SUD financial flags sandbox doğrulaması olmadan false
- Privacy Policy / Terms / account deletion URL
- Play Data Safety + App Store Privacy formu

Bu checklist tamamlandığında kalan iş ürün/UI polishing ve mağaza doğrulamasıdır.
