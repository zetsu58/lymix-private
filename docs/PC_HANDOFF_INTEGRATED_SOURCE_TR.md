# LYMIX V21.22.1 — PC Handoff Integrated Source

Durum: gerçek Codemagic Flutter source export + mobile audit + reference-video UX + production API contract + final PC handoff pass.

## Entegre edilen ana akışlar

- Production `/api/v1` auth, REGISTER OTP, rotating refresh/session storage.
- Gerçek session/profile modelinde `id`, `username`, `displayName`, `role`, `phoneE164`, `avatarUrl`.
- Aktif profil ekranında kullanıcı ID ve gerçek avatar; normal kullanıcıya sahte OWNER/Admin gösterilmez.
- `Kendi Odam / Odam / Odama Git` doğrudan kalıcı kullanıcı odasına girer; yeniden oda kurma formu istemez.
- RoomCreate -> Room geçişi replacement mantığıyla; odadan çıkınca creation formuna geri dönme engellenir.
- Koltuk: tek dokunuş otur/kalk, owner/admin için uzun bas yönetim; avatar koltuğa taşınır; katkı/şerit görseli kaldırılır.
- Oda ayarlarının boş callback'leri PK, Game Center, koltuk, sohbet temizleme vb. gerçek aksiyonlara bağlanır.
- Wallet/session/account/privacy çağrıları production `/api/v1` sözleşmesine taşınır.
- Game Center SUD katalog + native `sud_gip_plugin` host; code backend'den alınır, appSecret Flutter'a girmez.
- Lymix'e özgü animasyonlu launch deneyimi.
- Mobil ZIP içindeki eski backend/admin-web kopyaları finalizer tarafından kaldırılır; repo kökündeki `backend/` ve `admin-web/` source-of-truth kalır.

## Yerel doğrulama

Entegre kaynak ZIP'i yerelde oluşturuldu, ZIP CRC testi geçti. SHA-256: `2d37dffd94e6c80e00becb5bcb42dd959102873e871524163103e90613121ab6`.

Flutter SDK bu çalışma ortamında olmadığı için son `flutter analyze/test/build` doğrulaması Codemagic/VS Code üzerinde yapılmalıdır. Codemagic branch: `agent/flutter-source-export`.

## Dış bağımlılıklar

SUD `appId/appKey/appSecret`, Agora App ID/App Certificate, SMS provider, production API base URL ve Google Play/App Store ürün kimlikleri dış credential/config olarak kalır. Secret'lar source code/APK içine yazılmamalıdır.
