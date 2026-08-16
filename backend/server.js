const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: '64kb' }));
app.use('/api/auth', rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false }));
app.use('/api/games/sud', rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false }));

const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_LOGIN = process.env.LYMIX_ADMIN_LOGIN;
const ADMIN_PASSWORD = process.env.LYMIX_ADMIN_PASSWORD;
const ADMIN_NAME = process.env.LYMIX_ADMIN_DISPLAY_NAME || 'Lymix Emre';
const ADMIN_ID = process.env.LYMIX_ADMIN_USER_ID || 'owner_emre';

// SUD credentials must stay on the server. Never expose appSecret to Flutter.
const SUD_APP_ID = process.env.SUD_APP_ID || '';
const SUD_APP_KEY = process.env.SUD_APP_KEY || '';
const SUD_APP_SECRET = process.env.SUD_APP_SECRET || '';
const SUD_APP_SERVER_URL = process.env.SUD_APP_SERVER_URL || '';
const SUD_CONTACT_URL = 'https://console.sud.tech/';
const SUD_CONTACT_EMAIL = 'help@sud.tech';

if (!JWT_SECRET || JWT_SECRET.length < 32) console.warn('JWT_SECRET is missing or too short. Set a long random secret in Render.');
if (!ADMIN_LOGIN || !ADMIN_PASSWORD) console.warn('LYMIX admin credentials are not configured yet.');
if (!SUD_APP_ID || !SUD_APP_KEY || !SUD_APP_SECRET) console.warn('SUD credentials are not configured. Request appId/appKey/appSecret from Sud.Tech.');

const refreshTokens = new Map();
const trustedDevices = new Map();
const user = () => ({ id: ADMIN_ID, login: ADMIN_LOGIN || '', displayName: ADMIN_NAME, role: 'SUPER_ADMIN', level: 999, badges: ['FOUNDER','SUPER_ADMIN'] });

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
function signAccess() {
  return jwt.sign({ sub: ADMIN_ID, role: 'SUPER_ADMIN', level: 999 }, JWT_SECRET, { expiresIn: '15m', issuer: 'lymix' });
}
function makeRefresh(deviceId) {
  const token = crypto.randomBytes(48).toString('base64url');
  refreshTokens.set(token, { userId: ADMIN_ID, deviceId: String(deviceId || ''), expiresAt: Date.now() + 30*24*60*60*1000 });
  return token;
}
function requireLymixAuth(req, res, next) {
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  try {
    req.auth = jwt.verify(token, JWT_SECRET, { issuer: 'lymix' });
    next();
  } catch (_) {
    res.status(401).json({ message: 'Yetkisiz.' });
  }
}
function sudConfigured() {
  return Boolean(SUD_APP_ID && SUD_APP_KEY && SUD_APP_SECRET);
}

app.get('/', (_, res) => res.json({ ok: true, service: 'LYMIX Backend', version: '8.16.0' }));
app.get('/health', (_, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.post('/api/auth/login', (req, res) => {
  if (!JWT_SECRET || !ADMIN_LOGIN || !ADMIN_PASSWORD) return res.status(503).json({ message: 'Sunucu giriş ayarları tamamlanmadı.' });
  const { login, password, deviceId, deviceName, platform, appVersion } = req.body || {};
  if (!safeEqual(login, ADMIN_LOGIN) || !safeEqual(password, ADMIN_PASSWORD)) return res.status(401).json({ message: 'Kullanıcı adı veya şifre hatalı.' });
  const did = String(deviceId || 'unknown');
  trustedDevices.set(did, { deviceId: did, deviceName: String(deviceName || ''), platform: String(platform || ''), appVersion: String(appVersion || ''), lastLoginAt: new Date().toISOString() });
  res.json({ accessToken: signAccess(), refreshToken: makeRefresh(did), user: user() });
});

app.post('/api/auth/refresh', (req, res) => {
  if (!JWT_SECRET) return res.status(503).json({ message: 'Sunucu ayarı eksik.' });
  const token = String(req.body?.refreshToken || '');
  const session = refreshTokens.get(token);
  if (!session || session.expiresAt < Date.now()) { refreshTokens.delete(token); return res.status(401).json({ message: 'Oturum süresi doldu.' }); }
  res.json({ accessToken: signAccess() });
});

app.post('/api/auth/logout', (req, res) => {
  const token = String(req.body?.refreshToken || '');
  if (token) refreshTokens.delete(token);
  res.json({ ok: true });
});

app.get('/api/admin/me', requireLymixAuth, (req, res) => {
  res.json({ user: user(), trustedDeviceCount: trustedDevices.size });
});

// SUD integration discovery endpoint for Flutter/admin UI.
app.get('/api/games/sud/status', (_, res) => {
  res.json({
    provider: 'SUD',
    flutterSupported: true,
    configured: sudConfigured(),
    appIdConfigured: Boolean(SUD_APP_ID),
    appKeyConfigured: Boolean(SUD_APP_KEY),
    appSecretConfigured: Boolean(SUD_APP_SECRET),
    appServerUrlConfigured: Boolean(SUD_APP_SERVER_URL),
    contact: { url: SUD_CONTACT_URL, email: SUD_CONTACT_EMAIL },
    docs: 'https://docs-gitbook.sud.tech/en-US/app/Client/StartUp-Flutter.html'
  });
});

// Safe redirect target for the app/admin panel's “SUD ile iletişime geç” button.
app.get('/api/games/sud/contact', (_, res) => {
  res.redirect(302, SUD_CONTACT_URL);
});

// Flutter calls this route before loading a SUD game. The real short-term code
// must be produced with SUD's official server auth flow after credentials are issued.
app.post('/api/games/sud/session', requireLymixAuth, (req, res) => {
  if (!sudConfigured()) {
    return res.status(503).json({
      code: 'SUD_NOT_CONFIGURED',
      message: 'SUD appId/appKey/appSecret henüz tanımlı değil.',
      contact: { url: SUD_CONTACT_URL, email: SUD_CONTACT_EMAIL }
    });
  }

  const { roomId, mgId } = req.body || {};
  if (!roomId || !mgId) return res.status(400).json({ message: 'roomId ve mgId zorunludur.' });

  return res.status(501).json({
    code: 'SUD_AUTH_PACKAGE_PENDING',
    message: 'SUD server auth SDK erişimi etkinleştirildikten sonra kısa süreli game code burada üretilecek.',
    appId: SUD_APP_ID,
    roomId: String(roomId),
    mgId: String(mgId),
    userId: String(req.auth.sub),
    appServerUrl: SUD_APP_SERVER_URL || null
  });
});

app.listen(PORT, '0.0.0.0', () => console.log(`LYMIX backend listening on ${PORT}`));
