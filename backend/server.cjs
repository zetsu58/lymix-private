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

const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_LOGIN = process.env.LYMIX_ADMIN_LOGIN;
const ADMIN_PASSWORD = process.env.LYMIX_ADMIN_PASSWORD;
const ADMIN_NAME = process.env.LYMIX_ADMIN_DISPLAY_NAME || 'Lymix Emre';
const ADMIN_ID = process.env.LYMIX_ADMIN_USER_ID || 'owner_emre';

if (!JWT_SECRET || JWT_SECRET.length < 32) console.warn('JWT_SECRET is missing or too short. Set a long random secret.');
if (!ADMIN_LOGIN || !ADMIN_PASSWORD) console.warn('LYMIX admin credentials are not configured yet.');

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

app.get('/api/admin/me', (req, res) => {
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  try { jwt.verify(token, JWT_SECRET, { issuer: 'lymix' }); res.json({ user: user(), trustedDeviceCount: trustedDevices.size }); }
  catch (_) { res.status(401).json({ message: 'Yetkisiz.' }); }
});

app.listen(PORT, '0.0.0.0', () => console.log(`LYMIX backend listening on ${PORT}`));
