LYMIX



Sesinle Bağlan, Dünyanı Paylaş.
LYMIX; sesli sohbet odaları, sosyal etkileşim, sanal hediyeler, coin ekonomisi, ajans/yayıncı yönetimi, VIP ayrıcalıkları, etkinlikler ve oda içi mini oyunları tek platformda birleştirmeyi hedefleyen Flutter tabanlı bir sosyal eğlence uygulamasıdır.
Bu README, LYMIX'in ürün kapsamını, teknik mimarisini, modüllerini, entegrasyonlarını, güvenlik yaklaşımını ve production hedeflerini tek yerde belgelemek amacıyla hazırlanmıştır.
1. Proje Özeti
Ürün: LYMIX
Platformlar: Android / iOS
Mobil teknoloji: Flutter / Dart
Backend: Node.js / TypeScript
Veritabanı: PostgreSQL
ORM: Prisma
Gerçek zamanlı iletişim: WebSocket/Socket tabanlı servisler + RTC entegrasyonu
Ses altyapısı: Agora RTC odaklı mimari
Oyun altyapısı: SUD MGP / SUD Game entegrasyonu
Hedef pazar: Türkiye ve MENA
Ana dil: Türkçe
Planlanan diller: İngilizce, Almanca, İtalyanca, Rusça, Hintçe, Azerbaycanca
Android Application ID: com.lymix.app
LYMIX yalnızca bir sesli sohbet uygulaması olarak değil; kullanıcı, yayıncı, ajans, oda sahibi ve platform yönetiminin aynı ekonomi ve sosyal grafik üzerinde çalıştığı ölçeklenebilir bir sosyal eğlence ekosistemi olarak tasarlanmaktadır.
2. Ürün Vizyonu
LYMIX'in temel amacı kullanıcıların:
Sesli odalarda sosyalleşebilmesini,
Yeni insanları takip edip sosyal çevre oluşturabilmesini,
Oda içi oyunlara katılabilmesini,
Sanal hediyeler gönderebilmesini,
VIP ve seviye sistemleriyle ilerleyebilmesini,
Yayıncı olarak gelir modeli oluşturabilmesini,
Ajans yapılanmasına katılabilmesini,
Etkinlik ve sezon sistemleriyle uzun süreli etkileşim yaşayabilmesini
tek bir uygulama içerisinde sağlamaktır.
Platform; mobil istemci, backend servisleri, yönetim paneli, ödeme/coin altyapısı, RTC sistemi ve üçüncü taraf oyun sağlayıcıları arasında modüler bir mimari kullanmayı hedefler.
3. Ana Modüller
3.1 Authentication & Account
Production authentication sisteminin hedef kapsamı:
Kullanıcı kaydı
Giriş
Telefon doğrulama
SMS / OTP
Access token
Refresh token
JWT tabanlı kimlik doğrulama
Token rotation
Session yönetimi
Çoklu cihaz yönetimi
Aktif oturumları görüntüleme
Cihazdan çıkış
Tüm cihazlardan çıkış
Device ID takibi
Şüpheli oturum kontrolleri
Rate limiting
OTP deneme limiti
OTP süre aşımı
Hesap kapatma/silme akışı
Ban kontrolleri
Backend tarafında kullanıcı kimliği hiçbir zaman yalnızca istemci tarafından gönderilen userId değerine güvenilerek kabul edilmemelidir. Yetkilendirme doğrulanmış session/token üzerinden yapılmalıdır.
3.2 Kullanıcı Profili
Her kullanıcı için genişletilebilir profil modeli hedeflenmektedir.
Profil alanları:
Kullanıcı ID
Kullanıcı adı
Görünen ad
Profil fotoğrafı
Kapak/görsel alanları
Biyografi
Cinsiyet/uygulama tarafından gerekli görülen profil alanları
Ülke
Dil
Seviye
VIP seviyesi
Rozetler
Ajans bilgisi
Yayıncı durumu
Takipçi sayısı
Takip edilen sayısı
Hediye/etkileşim istatistikleri
Oda bilgileri
Doğrulama durumu
Profil görünümleri
Normal profil
Mini profil
Oda içi kullanıcı kartı
VIP profil görünümü
Yayıncı profili
Ajans bağlantılı profil
4. Sosyal Sistem
LYMIX sosyal grafiği aşağıdaki özellikleri destekleyecek şekilde tasarlanır:
Takip et
Takibi bırak
Takipçiler
Takip edilenler
Arkadaş/karşılıklı takip mantığı
Kullanıcı arama
Profil ziyaretleri
VIP'e göre ziyaretçi görünürlüğü
Engelleme
Şikâyet
Odaya davet
Kullanıcı paylaşımı
Sistem bildirimleri
5. Voice Room Sistemi
Sesli odalar LYMIX'in ana ürün bileşenlerinden biridir.
Oda özellikleri
Oda oluşturma
Oda adı
Oda açıklaması
Oda görseli
Oda arka planı
Hazır arka plan galerisi
Özel arka plan
Oda kilidi
Oda şifresi
Kullanıcı limiti
Oda kategorisi
Oda etiketi
Ülke/dil
Oda paylaşımı
Odayı takip etme
Odaya giriş isteği
Koltuk sistemi
Planlanan koltuk kapasitesi oda tipine göre:
8 -- 30 koltuk
Koltuk işlemleri:
Koltuğa çık
Koltuktan in
Kullanıcı davet et
Koltuk kilitle
Kilidi aç
Mikrofon aç
Mikrofon kapat
Admin tarafından mikrofon kontrolü
Kullanıcıyı koltuktan indir
Kullanıcıyı odadan çıkar
6. Oda Yetkilendirme Sistemi
Roller örneğin:
User
Broadcaster
Room Admin
Room Owner
Agency Broadcaster
Agency Admin
Agency Owner
Platform Moderator
Platform Admin
Super Admin
Her rol için backend tarafında ayrı permission kontrolleri uygulanmalıdır.
Room Owner
Admin atama
Admin kaldırma
Kullanıcı çıkarma
Mikrofon kontrolü
Koltuk kontrolü
Oda ayarları
Oda arka planı
Oda kilidi
Oda etkinlikleri
Room Admin
Yetkileri oda sahibi ve sistem politikaları tarafından sınırlandırılır.
7. RTC / Agora
LYMIX gerçek zamanlı ses iletişiminde Agora RTC entegrasyonunu kullanacak şekilde geliştirilmiştir.
Temel prensip:
Flutter Client
      |
      v
LYMIX Backend
      |
      +---- Token Service
      |
      v
Agora RTC
RTC tokenlarının production ortamında istemci içerisinde oluşturulmaması gerekir.
Backend:
Kullanıcı session'ını doğrular.
Oda erişimini kontrol eder.
RTC UID/identity eşleşmesini doğrular.
Kısa ömürlü RTC token üretir.
Mobil istemci token ile kanala katılır.
8. Gift System
LYMIX'in ana ekonomi bileşenlerinden biridir.
Hedef:
150--250+ sanal hediye destekleyebilecek genişletilebilir katalog.
Her hediye için:
giftId
name
coinPrice
assetUrl
animationUrl
category
rarity
isActive
eventId
createdAt
Hediye kategorileri:
Normal
Premium
VIP
Event
Seasonal
Relationship
Lucky
Limited
Animated
Full-screen
Animasyon formatları altyapıya göre Lottie, SVGA, WebM veya optimize edilmiş özel asset formatları olabilir.
9. Coin Ekonomisi
Coin sistemi yalnızca istemci bakiyesi olarak tutulmamalıdır.
Production tasarımında ledger yaklaşımı kullanılmalıdır.
Örnek:
CoinWallet
CoinLedger
CoinTransaction
GiftTransaction
PurchaseTransaction
Settlement
Refund
Adjustment
Her finansal işlem:
Benzersiz transaction ID
Kullanıcı
İşlem tipi
Önceki bakiye
Değişim
Sonraki bakiye
Kaynak
Timestamp
Metadata
ile kayıt altına alınmalıdır.
Temel prensip
Client requests transaction
        |
        v
Backend validates
        |
        v
Database transaction
        |
        +--> Ledger
        +--> Balance
        +--> Gift transaction
        |
        v
Result returned
İstemci hiçbir zaman kendi coin bakiyesini değiştiremez.
10. Lucky Gift / Çarpan Sistemi
LYMIX, şans tabanlı hediye mekaniklerini destekleyecek şekilde tasarlanmıştır.
Örnek çarpanlar:
2x
2.5x
5x
10x
50x
100x
500x
1000x
Gerçek production implementasyonunda sonuç üretimi tamamen backend tarafında gerçekleştirilmelidir.
Gerekli özellikler:
Server-side RNG
Audit log
Probability table
Event bazlı oranlar
Günlük limitler
Fraud kontrolleri
Transaction atomicity
İdempotency
Yönetim paneli audit trail
Yasal ve mağaza politikası gereksinimleri hedef pazarlara göre ayrıca değerlendirilmelidir.
11. VIP Sistemi
Planlanan ana VIP seviyeleri:
VIP 1
VIP 2
VIP 3
VIP 4
VIP 5
VIP 6
VIP 7
VIP 8
VIP 9
VIP 10
VIP Plus
VIP avantajları yapılandırılabilir olmalıdır.
Örnek avantajlar:
Özel rozet
Profil çerçevesi
Giriş efekti
Oda giriş animasyonu
Özel hediye erişimi
Ziyaretçi gizleme/görüntüleme avantajları
Özel profil görünümü
Özel renkler
Özel mesaj efektleri
Mağaza avantajları
Giriş efektleri kullanıcı tarafından kapatılabilir şekilde tasarlanmalıdır.
12. Level Sistemi
Kullanıcı aktivitelerine göre XP/level sistemi.
XP kaynakları örneğin:
Oda aktivitesi
Hediye gönderimi
Etkinlik
Sosyal görevler
Platform görevleri
XP hesaplaması backend tarafından yapılmalıdır.
13. Agency Sistemi
LYMIX'in ticari ve yayıncı yönetim modüllerinden biridir.
Agency Owner
Ajans paneli
Yayıncı listesi
Yayıncı başvuruları
Kota takibi
Performans
Oda yönetimi
Ajans yöneticileri
Gelir/settlement raporları
Yayıncı
Ajansa başvuru
Ajans bilgisi
Kota
Mikrofon süresi
Hediye performansı
Gelir durumu
Transfer durumu
Transfer
Planlanan ajans transfer kilidi:
3 ay
Kurallar backend tarafından uygulanmalıdır.
Admission Room
Ajans kabul odası için:
Maksimum 6 yönetici
Başvuru inceleme
Yayıncı kabul/red
Yetkilendirilmiş işlemler
14. Broadcaster Verification
Yayıncı hesabına geçiş için doğrulama sistemi planlanmaktadır.
Kapsam:
Telefon doğrulaması
Canlılık kontrolü
Yüz doğrulama
Başını sağa/sola çevirme
Yukarı bakma
Gülümseme gibi challenge'lar
Verification sonucu
Doğrulanmış yayıncı rozeti
Biyometrik süreçler yürürlükteki gizlilik ve veri koruma mevzuatına uygun tasarlanmalıdır.
15. Relationship / Ring System
Kullanıcılar arasında özel ilişki sistemi.
Özellikler:
Ring oluşturma
Davet
Kabul/red
Normal ring
Seasonal ring
Animasyonlu ring
Profil rozeti
Oda görünümü
Süre
Seviye
Özel hediyeler
16. Feed / Akış
Sosyal içerik modülü.
Özellikler:
Gönderi oluşturma
Görsel
Metin
Beğeni
Yorum
Kullanıcı profiline geçiş
Şikâyet
Moderasyon
Takip edilen içerikleri
Önerilen içerikler
17. Event Sistemi
LYMIX etkinlik motoru tekrar kullanılabilir ve yönetilebilir olmalıdır.
Örnek etkinlik periyodu:
Pazartesi → Pazar, bitiş 05:00
Event modeli:
Event
EventRule
EventReward
EventLeaderboard
EventParticipant
EventAsset
EventSchedule
Desteklenen etkinlik türleri:
Haftalık
Aylık
Seasonal
Gift
Room
Agency
Broadcaster
VIP
Relationship
Game
Uzun dönem etkinlik takvimi admin panelinden yönetilebilir olmalıdır.
18. SUD Game / Game Center
LYMIX, oda içerisinde üçüncü taraf mini oyunları çalıştırmak için SUD entegrasyonu hedeflemektedir.
Planlanan akış:
Flutter
   |
   v
LYMIX Backend
   |
   +--> SUD Auth Gateway
   +--> Short-term Code
   +--> Server API
   +--> Callback Verification
   |
   v
SUD Platform
Backend tarafında hazırlanan/hedeflenen bileşenler:
Authentication gateway
Short-term code flow
Callback endpoints
Server API signing
Callback signature verification
Game catalog API
Game report API
Room/game control events
Order adapters
Query adapters
Production için sağlayıcı tarafından gereken değerler:
SUD_APP_ID=
SUD_APP_KEY=
SUD_APP_SECRET=
Ayrıca Android applicationId, iOS bundleId, etkin mgId değerleri ve production/sandbox yetkileri sağlayıcı tarafında tanımlanmalıdır.
19. Game Center
Kullanıcı:
Voice Room'a girer.
Game Center'ı açar.
Oyun seçer.
Backend erişimi doğrular.
Oyun session'ı oluşturulur.
Oyun oda bağlamında başlatılır.
Oyunlara güvenli şekilde ilişkilendirilebilecek bağlam:
userId
roomId
gameId
sessionId
Client tarafından gönderilen kimlik bilgileri backend doğrulaması olmadan güvenilir kabul edilmemelidir.
20. Payment System
Coin satın alma sistemi platform politikalarına uygun şekilde tasarlanmalıdır.
Mobil uygulamalarda:
Google Play Billing
Apple In-App Purchase / StoreKit
desteklenir.
Backend tarafında:
Purchase verification
Receipt validation
Transaction ID
Duplicate purchase prevention
Refund handling
Coin credit
Audit log
gereklidir.
21. Store
Mağaza üzerinden sunulabilecek içerikler:
Coin paketleri
VIP
Profil çerçeveleri
Giriş efektleri
Oda efektleri
Özel hediyeler
Seasonal ürünler
Ring ürünleri
22. Moderation & Safety
Platform güvenliği kritik bir backend modülüdür.
Desteklenmesi planlanan sistemler:
Kullanıcı şikâyeti
Oda şikâyeti
İçerik şikâyeti
Kullanıcı susturma
Oda banı
Platform banı
Device ban
Riskli cihaz kontrolleri
Spam koruması
Rate limiting
Küfür filtresi
Metin moderasyonu
Ses moderasyonu için AI destekli sistemler
Moderatör işlem geçmişi
23. Device Management
Cihaz kayıtlarında güvenli biçimde tutulabilecek alanlar:
deviceId
userId
platform
appVersion
lastSeenAt
createdAt
isTrusted
isBanned
Ham ve gereksiz cihaz verileri toplanmamalıdır.
24. Admin Panel
LYMIX yönetim paneli platform operasyonlarının merkezi olarak planlanmaktadır.
Dashboard:
Toplam kullanıcı
Aktif kullanıcı
Online kullanıcı
Aktif oda
Yayıncı
Ajans
Coin hacmi
Gift hacmi
Server durumu
Kullanıcı yönetimi
Kullanıcı ara
Profil görüntüle
Rol değiştir
Ban
Ban kaldır
Coin adjustment
VIP
Level
Ajans
Yayıncı durumu
Agency
Ajans oluştur
Ajans kapat
Owner değiştir
Yayıncı listesi
Kota
Transfer
Moderation
Reports
Ban history
Device bans
Moderation queue
Event
Event oluştur
Başlangıç/bitiş
Gift seçimi
Ödüller
Banner
Aktif/pasif
Sistem
Splash reklamı
Feature flags
Maintenance mode
Sistem mesajları
Uygulama minimum versiyonu
25. Notification System
Bildirim kategorileri:
Takip
Hediye
Oda daveti
Agency
Broadcaster
VIP
Event
Relationship
Moderation
Sistem
Push notification için provider soyutlaması kullanılmalıdır.
26. Çoklu Dil
Varsayılan:
tr
Planlanan:
tr
en
de
it
ru
hi
az
UI içerisinde sabit metin kullanımı minimumda tutulmalı ve localization key yapısı kullanılmalıdır.
Örnek:
{
  "room.join": "Odaya Katıl",
  "room.leave": "Odadan Ayrıl",
  "gift.send": "Hediye Gönder"
}
27. Önerilen Sistem Mimarisi
┌─────────────────┐
                    │ Flutter Client  │
                    │ Android / iOS   │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   API Gateway   │
                    └────────┬────────┘
                             │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
     Auth Service       Social Service      Room Service
          │                  │                  │
          ├──────────┬───────┴─────────┬────────┤
          ▼          ▼                 ▼        ▼
       Wallet      Gifts             Agency    Events
          │          │                 │        │
          └──────────┴────────┬────────┴────────┘
                              ▼
                         PostgreSQL
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
           Agora            SUD            Payments
Başlangıçta modüler monolith yaklaşımı kullanılabilir. Trafik ve operasyonel ihtiyaç oluşmadan gereksiz microservice ayrıştırmasından kaçınılmalıdır.
28. Backend Teknolojileri
Ana hedef stack:
Node.js
TypeScript
PostgreSQL
Prisma
JWT
WebSocket
REST API
Production yardımcı servisleri:
Redis
Object Storage
CDN
Push Notification Provider
Observability
Error Tracking
Metrics
ihtiyaca göre eklenebilir.
29. Flutter Mimari Prensipleri
Mobil uygulama feature bazlı ayrıştırılmalıdır.
Örnek:
lib/
├── app/
├── core/
│   ├── api/
│   ├── auth/
│   ├── config/
│   ├── errors/
│   ├── localization/
│   ├── storage/
│   └── theme/
│
├── features/
│   ├── auth/
│   ├── home/
│   ├── profile/
│   ├── room/
│   ├── gift/
│   ├── wallet/
│   ├── vip/
│   ├── agency/
│   ├── games/
│   ├── feed/
│   ├── events/
│   └── settings/
│
└── main.dart
30. Backend Örnek Klasör Yapısı
src/
├── config/
├── database/
├── middleware/
├── common/
│
├── modules/
│   ├── auth/
│   ├── users/
│   ├── profiles/
│   ├── rooms/
│   ├── rtc/
│   ├── gifts/
│   ├── wallet/
│   ├── vip/
│   ├── agency/
│   ├── games/
│   ├── sud/
│   ├── events/
│   ├── feed/
│   ├── moderation/
│   ├── notifications/
│   └── payments/
│
├── app.ts
└── server.ts
Bu yapı mevcut repository gerçekliğiyle uyumlu olacak şekilde uygulanmalıdır; README uğruna çalışan kod yeniden yapılandırılmamalıdır.
31. Prisma / Database
Ana domain modelleri örneğin:
User
Profile
Device
Session
OtpRequest
RefreshToken
Follow
Block
Room
RoomMember
RoomSeat
RoomAdmin
Gift
GiftTransaction
Wallet
CoinLedger
VipSubscription
Agency
AgencyMember
Broadcaster
Event
EventParticipant
GameSession
Report
Ban
Notification
Purchase
Settlement
Database kuralları
Foreign key
Unique constraint
Index
Transaction
Idempotency
Audit log
Soft delete gerektiği yerde
Migration yönetimi
production için zorunlu kabul edilmelidir.
32. API Tasarım Prensipleri
Örnek endpoint yapısı:
/api/v1/auth/*
/api/v1/users/*
/api/v1/profiles/*
/api/v1/rooms/*
/api/v1/gifts/*
/api/v1/wallet/*
/api/v1/vip/*
/api/v1/agencies/*
/api/v1/games/*
/api/v1/events/*
/api/v1/feed/*
/api/v1/reports/*
/api/v1/payments/*
Standart response örneği:
{
  "success": true,
  "data": {},
  "error": null
}
33. Environment Variables
Production secret'ları repository'ye commit edilmemelidir.
Örnek .env.example:
NODE_ENV=development
PORT=3000

DATABASE_URL=

JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=

REDIS_URL=

AGORA_APP_ID=
AGORA_APP_CERTIFICATE=

SUD_APP_ID=
SUD_APP_KEY=
SUD_APP_SECRET=

FCM_PROJECT_ID=

APPLE_BUNDLE_ID=
ANDROID_PACKAGE_NAME=com.lymix.app
Gerçek secret değerleri .env.example içerisinde bulunmamalıdır.
34. Security
Production öncesi uygulanması gereken başlıca kontroller:
Authentication
Güçlü token signing
Refresh rotation
Token revoke
OTP brute-force koruması
Rate limiting
API
Input validation
Authentication middleware
RBAC
Request limits
Secure headers
CORS policy
Error sanitization
Database
Parameterized ORM queries
Minimum DB privilege
Backup
Migration kontrolü
Audit
Economy
Server-authoritative balance
Atomic transactions
Idempotency keys
Replay protection
Purchase verification
Gift transaction verification
External callbacks
Signature verification
Timestamp validation
Replay prevention
Provider allow-list gerektiğinde
35. Privacy
LYMIX; minimum veri toplama prensibini benimsemelidir.
Özellikle:
Telefon
Cihaz bilgileri
Yüz doğrulama verileri
Ödeme kayıtları
Moderasyon kayıtları
için erişim kontrolü, retention politikası ve gerekli hukuki metinler uygulanmalıdır.
Hedef pazarlardaki KVKK ve ilgili veri koruma yükümlülükleri production öncesinde değerlendirilmelidir.
36. Android
Ana Android Application ID:
com.lymix.app
Geliştirme hedefi modern Android SDK sürümlerini desteklemektir.
Build örneği:
flutter pub get
flutter analyze
flutter test
flutter build apk --debug
Production:
flutter build appbundle --release
Release build için signing yapılandırması ayrıca gereklidir.
37. iOS
Production öncesinde:
Bundle ID
Signing
Provisioning
Push notification
StoreKit
Privacy manifest
RTC izinleri
Mikrofon açıklaması
doğrulanmalıdır.
38. Temel İzinler
LYMIX özelliklerine bağlı olarak:
Mikrofon
Kamera
Fotoğraf/medya
Bildirim
izinlerine ihtiyaç duyabilir.
İzinler yalnızca ilgili özellik kullanıldığı anda istenmelidir.
39. CI/CD
Pipeline hedefi:
Install
   ↓
Dependency Check
   ↓
Format
   ↓
Analyze
   ↓
Unit Tests
   ↓
Integration Tests
   ↓
Android Build
   ↓
iOS Build
   ↓
Artifact
Main branch'e hatalı kodun doğrudan production release üretmesi engellenmelidir.
40. Test Stratejisi
Flutter
Unit test
Widget test
Integration test
Golden test gerektiğinde
Gerçek cihaz testleri
Backend
Unit
Integration
API
Auth
Permission
Wallet
Gift
Payment
Callback
Production kritik senaryolar
Özellikle:
Register
Login
OTP
Refresh token
Logout
Room join
RTC join
Seat operations
Gift send
Coin debit
Coin credit
Lucky transaction
Purchase
Agency permissions
Ban
SUD callback
otomatik testlerle kapsanmalıdır.
41. Performans
Optimizasyon alanları:
Pagination
Lazy loading
Image caching
CDN
DB indexes
Redis cache
Connection pooling
WebSocket lifecycle
RTC resource cleanup
Gift animation lifecycle
42. Observability
Production backend aşağıdaki sinyalleri üretmelidir:
Structured logs
Error tracking
Request latency
Error rate
Active WebSocket
Active room
RTC errors
Payment failures
Gift transaction failures
DB latency
CPU/RAM
Provider callback failures
43. Feature Flags
Riskli veya aşamalı özellikler feature flag ile yönetilebilir.
Örnek:
games_enabled
lucky_gifts_enabled
agency_enabled
new_profile_enabled
maintenance_mode
splash_campaign_enabled
44. Sürümleme
Örnek Flutter version:
version: 21.22.0+237
Format:
MAJOR.MINOR.PATCH+BUILD
Her production release için changelog tutulması önerilir.
45. Production Öncesi Kritik Checklist
[ ] Auth production-ready
[ ] OTP provider
[ ] JWT rotation
[ ] Session/device management
[ ] User DB
[ ] Profile
[ ] Agora production token
[ ] Voice Room permissions
[ ] Gift catalog
[ ] Coin ledger
[ ] Settlement
[ ] Payment verification
[ ] Agency
[ ] Broadcaster verification
[ ] SUD credentials
[ ] SUD sandbox tests
[ ] SUD production approval
[ ] Moderation
[ ] Device ban
[ ] Push notification
[ ] Admin panel
[ ] Localization
[ ] Android release signing
[ ] iOS signing
[ ] Privacy documents
[ ] Terms of Service
[ ] Store compliance
[ ] Load tests
[ ] Security tests
[ ] Backup strategy
[ ] Monitoring
46. Güncel Geliştirme Odağı
Mimari ve ana modül planlamasının ardından production geliştirme sırası aşağıdaki şekilde ele alınabilir:
Phase 1 --- Auth
Prisma User
Device
Session
OTP
JWT
Refresh Token
Auth Middleware
RBAC
Phase 2 --- User
Profile
Follow
Block
Level
VIP
Phase 3 --- Voice
Room
Seat
Permissions
Agora
RTC Token
Realtime Events
Phase 4 --- Economy
Wallet
Ledger
Gift
Lucky
Settlement
Phase 5 --- Agency
Agency
Broadcaster
Quota
Transfer
Settlement
Phase 6 --- Games
Game Center
SUD Flutter
SUD Backend
Callbacks
Orders
Reports
Phase 7 --- Social
Feed
Relationship
Events
Notifications
Phase 8 --- Operations
Admin Panel
Moderation
Analytics
Monitoring
Security
Phase 9 --- Release
Android Production
iOS Production
Store Review
Load Test
Production Deployment
47. Development Philosophy
LYMIX geliştirilirken temel prensip:
Çalışan sistemi gereksiz yere yeniden yazma; eksik modülü production seviyesinde tamamla.
Bu nedenle:
Flutter korunur.
Node.js backend korunur.
Repository source of truth kabul edilir.
Büyük rewrite yerine kontrollü refactor yapılır.
Her modül ayrı tamamlanır.
Modül tamamlanmadan sonraki kritik modüle geçilmez.
Test edilebilir checkpoint'ler oluşturulur.
UI ve backend sözleşmeleri birlikte doğrulanır.
48. Definition of Done
Bir modül yalnızca UI görünüyorsa tamamlanmış sayılmaz.
Bir production modülü için:
UI
API
Database
Validation
Authentication
Authorization
Error Handling
Loading State
Empty State
Security
Tests
Logs
Documentation
tamamlanmalıdır.
49. Repository Kuralları
Secret commit etme.
Production credential paylaşma.
Generated dosyaları bilinçsizce source of truth yapma.
Migration'ları review et.
API değişikliklerini dokümante et.
Main branch'i çalışır durumda tut.
Büyük değişiklikleri küçük ve geri alınabilir commit'lere böl.
Coin/payment değişikliklerinde ekstra review uygula.
Provider callback'lerini imza doğrulaması olmadan kabul etme.
50. Marka
LYMIX
Slogan:
Sesinle Bağlan, Dünyanı Paylaş.
Ana marka yaklaşımı:
Modern
Sosyal
Premium
Eğlence odaklı
Türkiye/MENA uyumlu
Mobil öncelikli
51. Roadmap Özeti
Authentication
      ↓
User/Profile
      ↓
Voice Rooms
      ↓
Agora
      ↓
Gift + Wallet
      ↓
VIP + Level
      ↓
Agency
      ↓
SUD Games
      ↓
Feed + Events
      ↓
Moderation
      ↓
Admin
      ↓
Production Hardening
      ↓
Android / iOS Release
52. Sonuç
LYMIX; sesli iletişim, sosyal ağ, sanal ekonomi, yayıncı/ajans altyapısı ve oyun sistemlerini tek bir mobil ürün altında birleştiren kapsamlı bir platform olarak geliştirilmektedir.
Projenin production başarısı yalnızca arayüzün tamamlanmasına değil; özellikle Auth, RTC, Wallet/Ledger, Gift, Payment, Agency, Moderation ve provider entegrasyonlarının server-authoritative ve güvenli şekilde tamamlanmasına bağlıdır.
Bu README yaşayan bir dokümandır. Uygulamanın gerçek kod tabanı ilerledikçe tamamlanan modüller, endpoint'ler, migration'lar, provider yapılandırmaları ve release prosedürleri güncellenmelidir.
License
LYMIX private/proprietary project.
Source code, product assets, backend logic and internal documentation may not be copied, redistributed or commercially used without authorization.
© LYMIX. All rights reserved.
