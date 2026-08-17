# Lymix Emergent Staging Kurulumu

Bu belge yalnızca development/staging içindir. Production startup yolu değişmez:

```bash
cd backend
npm start
```

Emergent ingress web/admin ve API trafiğini farklı container portlarına yönlendiriyorsa:

```bash
cd backend
npm run start:emergent
```

Bu komut aynı Express uygulamasını `PORT` (varsayılan 3000) ve `API_PORT` (varsayılan 8001) üzerinde dinletir. Mevcut zincir korunur:

`start_emergent.js -> admin_bootstrap.js -> bootstrap.js -> server.js`

## 1. PostgreSQL

Development container için PostgreSQL 15 kullanılabilir. Production'da mümkünse managed PostgreSQL kullanın.

Örnek lokal kurulum:

```bash
apt-get update
apt-get install -y postgresql-15 postgresql-client-15
pg_ctlcluster 15 main start
```

DB ve kullanıcı bilgilerini kendiniz üretin. Dokümana veya GitHub'a parola yazmayın.

Bağlantı testi:

```bash
PGPASSWORD='<DB_PASSWORD>' psql -h 127.0.0.1 -U lymix -d lymix -c 'SELECT 1;'
```

## 2. Environment

`backend/.env.staging.example` dosyasını örnek alın. Gerçek `.env` Git tarafından ignore edilir.

Zorunlu staging değerleri:

- `DATABASE_URL`
- `JWT_SECRET` (en az 32 karakter, rastgele)
- `OTP_PEPPER` (ayrı rastgele secret)
- `LYMIX_ADMIN_LOGIN`
- `LYMIX_ADMIN_PASSWORD`
- `LYMIX_ADMIN_PHONE_E164`

Development'ta `ALLOW_DEV_OTP=true` kullanılabilir. Production'da mutlaka `false` olmalıdır.

SUD sandbox erişimi gelmeden tüm coin/order feature flag'leri kapalı kalmalıdır. Callback doğrulaması varsayılan olarak açık tutulur.

## 3. Backend hazırlığı

Lockfile varsa `npm ci`, yoksa `npm install` kullanın:

```bash
cd backend
npm install --no-audit --no-fund
npm run prisma:migrate:deploy
npm run admin:seed
```

Production/staging DB şemasını kurmak için `prisma migrate deploy` kullanılır; `prisma db push` production migration yerine kullanılmamalıdır.

## 4. Emergent dual-port startup

```bash
PORT=3000 API_PORT=8001 npm run start:emergent
```

Beklenen yollar:

- Admin: `http://localhost:3000/admin/`
- API health: `http://localhost:8001/api/v1/health`

Aynı uygulama iki portta servis edilir. Bu, yalnız Emergent ingress uyumluluğu içindir.

## 5. Supervisor

`deploy/emergent/lymix.conf.example` örneğini ortama göre kopyalayın. Secret değerleri supervisor dosyasına gömmek yerine environment/secret manager kullanın.

```bash
supervisorctl reread
supervisorctl update
supervisorctl restart lymix-backend
```

## 6. Doğrulama

```bash
curl -fsS http://localhost:8001/api/v1/health
curl -fsS http://localhost:3000/admin/ | head
```

Admin login testi:

```bash
curl -fsS -X POST http://localhost:8001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"login":"<ADMIN_LOGIN>","password":"<ADMIN_PASSWORD>","deviceKey":"staging-check","platform":"web"}'
```

Access/refresh token çıktısını loglara veya dokümana kopyalamayın.

## 7. Flutter backend URL

Flutter uygulamasında staging ve production URL'lerini build-time config ile ayırın. Önerilen yaklaşım:

```dart
const apiBase = String.fromEnvironment(
  'LYMIX_API_BASE',
  defaultValue: 'http://10.0.2.2:3000',
);
```

Build örneği:

```bash
flutter build apk --dart-define=LYMIX_API_BASE=https://<staging-host>
```

Repo içindeki gerçek Flutter kaynakları ZIP'ten çıkarıldıktan sonra bu yapı mevcut environment/config servisine uyarlanacaktır.

## 8. Production geçiş kontrolü

Production öncesi:

- `NODE_ENV=production`
- `ALLOW_DEV_OTP=false`
- güçlü ve yeni `JWT_SECRET`
- ayrı güçlü `OTP_PEPPER`
- gerçek SMS provider
- HTTPS reverse proxy / load balancer
- managed veya yedekli PostgreSQL
- düzenli DB backup ve restore testi
- `SUD_VERIFY_CALLBACK_SIGNATURES=true`
- SUD ledger/order feature flag'lerini yalnız sandbox testlerinden sonra açma
- staging admin parolasını production'da tekrar kullanmama

Emergent staging ortamı production verisi veya production secret'ları için kullanılmamalıdır.
