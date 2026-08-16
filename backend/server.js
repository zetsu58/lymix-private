const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { SudAuthAdapter } = require('./sud_auth_adapter');
const { SudServerApi, createSudCallbackVerifier } = require('./sud_server_api');

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: true, credentials: false }));
app.use(express.json({
  limit: '64kb',
  verify: (req, _res, buf) => { req.rawBody = buf.toString('utf8'); }
}));
app.use('/api/auth', rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false }));
app.use('/api/games/sud', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }));

const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_LOGIN = process.env.LYMIX_ADMIN_LOGIN;
const ADMIN_PASSWORD = process.env.LYMIX_ADMIN_PASSWORD;
const ADMIN_NAME = process.env.LYMIX_ADMIN_DISPLAY_NAME || 'Lymix Emre';
const ADMIN_ID = process.env.LYMIX_ADMIN_USER_ID || 'owner_emre';

const SUD_APP_ID = process.env.SUD_APP_ID || '';
const SUD_APP_KEY = process.env.SUD_APP_KEY || '';
const SUD_APP_SECRET = process.env.SUD_APP_SECRET || '';
const SUD_APP_SERVER_URL = process.env.SUD_APP_SERVER_URL || '';
const SUD_CODE_TTL_MS = Number(process.env.SUD_CODE_TTL_MS || 0);
const SUD_SSTOKEN_TTL_MS = Number(process.env.SUD_SSTOKEN_TTL_MS || 0);
const SUD_API_CONFIG_CACHE_MS = Number(process.env.SUD_API_CONFIG_CACHE_MS || 24 * 60 * 60 * 1000);
const SUD_CALLBACK_MAX_SKEW_MS = Number(process.env.SUD_CALLBACK_MAX_SKEW_MS || 5 * 60 * 1000);
const SUD_VERIFY_CALLBACK_SIGNATURES = String(process.env.SUD_VERIFY_CALLBACK_SIGNATURES || 'true').toLowerCase() === 'true';
const SUD_CONTACT_URL = 'https://console.sud.tech/';
const SUD_CONTACT_EMAIL = 'help@sud.tech';

const sudAuth = new SudAuthAdapter({ appId: SUD_APP_ID, appSecret: SUD_APP_SECRET });
const sudApi = new SudServerApi({ appId: SUD_APP_ID, appSecret: SUD_APP_SECRET, configCacheMs: SUD_API_CONFIG_CACHE_MS });
const verifySudCallback = createSudCallbackVerifier({ appId: SUD_APP_ID, appSecret: SUD_APP_SECRET, maxSkewMs: SUD_CALLBACK_MAX_SKEW_MS });
const sudCallbackSecurity = SUD_VERIFY_CALLBACK_SIGNATURES ? verifySudCallback : (_req, _res, next) => next();

if (!JWT_SECRET || JWT_SECRET.length < 32) console.warn('JWT_SECRET is missing or too short. Set a long random secret in Render.');
if (!ADMIN_LOGIN || !ADMIN_PASSWORD) console.warn('LYMIX admin credentials are not configured yet.');
if (!SUD_APP_ID || !SUD_APP_KEY || !SUD_APP_SECRET) console.warn('SUD credentials are not configured. Request appId/appKey/appSecret from Sud.Tech.');
if (SUD_APP_ID && SUD_APP_SECRET && !sudAuth.available) console.warn(`SUD Node auth SDK is unavailable: ${sudAuth.status.reason}`);
if (!SUD_VERIFY_CALLBACK_SIGNATURES) console.warn('SUD callback signature verification is DISABLED. Do not use this in production.');

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
  refreshTokens.set(token, { userId: ADMIN_ID, deviceId: String(deviceId || ''), expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 });
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
function requireSuperAdmin(req, res, next) {
  if (req.auth?.role !== 'SUPER_ADMIN') return res.status(403).json({ message: 'Baş Admin yetkisi gerekli.' });
  next();
}
function sudConfigured() {
  return Boolean(SUD_APP_ID && SUD_APP_KEY && SUD_APP_SECRET);
}
function sudReady() {
  return sudConfigured() && sudAuth.available;
}
function normalizeSudError(result) {
  return Number(result?.sdkErrorCode ?? result?.sdk_error_code ?? 1005);
}
function sudUserInfo(uid) {
  const id = String(uid || '');
  const isAdmin = id === ADMIN_ID;
  return {
    uid: id,
    nick_name: isAdmin ? ADMIN_NAME : `Lymix ${id}`,
    avatar_url: '',
    gender: '',
    is_ai: 0,
    ai_level: 0
  };
}
function sudFailure(res, sdkErrorCode = 1005, message = '') {
  return res.status(200).json({ ret_code: 1, ret_msg: message, sdk_error_code: sdkErrorCode, data: {} });
}
function sudApiError(res, error, publicCode) {
  console.error(`${publicCode}:`, error);
  return res.status(502).json({
    code: publicCode,
    message: 'SUD sunucu API isteği tamamlanamadı.',
    sudRetCode: error?.retCode ?? null
  });
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

app.get('/api/games/sud/status', (_, res) => {
  res.json({
    provider: 'SUD',
    flutterSupported: true,
    configured: sudConfigured(),
    authSdk: sudAuth.status,
    ready: sudReady(),
    serverApiConfigured: sudApi.configured,
    callbackSignatureVerification: SUD_VERIFY_CALLBACK_SIGNATURES,
    appIdConfigured: Boolean(SUD_APP_ID),
    appKeyConfigured: Boolean(SUD_APP_KEY),
    appSecretConfigured: Boolean(SUD_APP_SECRET),
    appServerUrlConfigured: Boolean(SUD_APP_SERVER_URL),
    contact: { url: SUD_CONTACT_URL, email: SUD_CONTACT_EMAIL },
    docs: 'https://docs-gitbook.sud.tech/en-US/app/Server/API/'
  });
});

app.get('/api/games/sud/contact', (_, res) => res.redirect(302, SUD_CONTACT_URL));

app.post('/api/games/sud/get-code', requireLymixAuth, (req, res) => {
  if (!sudConfigured()) {
    return res.status(503).json({ code: 'SUD_NOT_CONFIGURED', message: 'SUD appId/appKey/appSecret henüz tanımlı değil.', contact: { url: SUD_CONTACT_URL, email: SUD_CONTACT_EMAIL } });
  }
  if (!sudAuth.available) {
    return res.status(503).json({ code: 'SUD_AUTH_SDK_UNAVAILABLE', message: 'SUD Node auth package erişimi/kurulumu henüz tamamlanmadı.', detail: sudAuth.status.reason });
  }
  try {
    const uid = String(req.auth.sub);
    const token = sudAuth.getCode(uid, SUD_CODE_TTL_MS);
    if (!token?.code) throw new Error('SUD SDK returned an empty code');
    return res.json({
      appId: SUD_APP_ID,
      appKey: SUD_APP_KEY,
      code: token.code,
      expireDate: Number(token.expireDate || 0),
      userId: uid,
      roomId: req.body?.roomId ? String(req.body.roomId) : null,
      mgId: req.body?.mgId ? String(req.body.mgId) : null,
      isTestEnv: String(process.env.SUD_IS_TEST_ENV || 'true').toLowerCase() === 'true'
    });
  } catch (error) {
    console.error('SUD get-code failed:', error);
    return res.status(502).json({ code: 'SUD_GET_CODE_FAILED', message: 'SUD kısa süreli code üretilemedi.' });
  }
});

app.post('/api/games/sud/session', requireLymixAuth, (_req, res) => res.redirect(307, '/api/games/sud/get-code'));

// Server API discovery is sensitive operational metadata, so expose it only to Baş Admin.
app.get('/api/games/sud/server/config', requireLymixAuth, requireSuperAdmin, async (_req, res) => {
  try {
    const config = await sudApi.getConfig();
    const api = config?.api || {};
    return res.json({
      ok: true,
      available: Object.keys(api).filter((key) => typeof api[key] === 'string' && api[key].startsWith('https://')),
      cachedAt: sudApi.cachedAt
    });
  } catch (error) {
    return sudApiError(res, error, 'SUD_CONFIG_DISCOVERY_FAILED');
  }
});

app.get('/api/games/sud/catalog', requireLymixAuth, async (req, res) => {
  try {
    const result = await sudApi.getGameList({ platform: req.query.platform || 2, unityEngineVersion: req.query.unityEngineVersion });
    return res.json(result);
  } catch (error) {
    return sudApiError(res, error, 'SUD_GAME_LIST_FAILED');
  }
});

app.get('/api/games/sud/game/:mgId', requireLymixAuth, async (req, res) => {
  try {
    const result = await sudApi.getGameInfo(req.params.mgId, { platform: req.query.platform || 2, unityEngineVersion: req.query.unityEngineVersion });
    return res.json(result);
  } catch (error) {
    return sudApiError(res, error, 'SUD_GAME_INFO_FAILED');
  }
});

app.post('/api/games/sud/reports/query', requireLymixAuth, async (req, res) => {
  try {
    const result = await sudApi.queryGameReport({
      gameRoundId: req.body?.gameRoundId,
      reportGameInfoKey: req.body?.reportGameInfoKey,
      filterTypes: req.body?.filterTypes
    });
    return res.json(result);
  } catch (error) {
    return sudApiError(res, error, 'SUD_GAME_REPORT_QUERY_FAILED');
  }
});

app.get('/api/games/sud/reports/room/:roomId', requireLymixAuth, async (req, res) => {
  try {
    const result = await sudApi.getRoomReports({ roomId: req.params.roomId, pageNo: req.query.pageNo, pageSize: req.query.pageSize });
    return res.json(result);
  } catch (error) {
    return sudApiError(res, error, 'SUD_ROOM_REPORTS_FAILED');
  }
});

app.get('/api/games/sud/results/:gameRoundId', requireLymixAuth, async (req, res) => {
  try {
    const result = await sudApi.getPlayerResults({ gameRoundId: req.params.gameRoundId, pageNo: req.query.pageNo, pageSize: req.query.pageSize });
    return res.json(result);
  } catch (error) {
    return sudApiError(res, error, 'SUD_PLAYER_RESULTS_FAILED');
  }
});

const SUD_ALLOWED_EVENTS = new Set([
  'user_in', 'user_out', 'user_ready', 'game_start', 'captain_change', 'user_kick',
  'game_end', 'game_setting', 'ai_add', 'room_info', 'quick_start', 'room_clear',
  'game_create', 'game_delete', 'mode_ex_change', 'user_in_batch', 'draw_image_clear'
]);

app.post('/api/games/sud/events', requireLymixAuth, async (req, res) => {
  const event = String(req.body?.event || '');
  const mgId = String(req.body?.mgId || '');
  const data = req.body?.data;
  if (!SUD_ALLOWED_EVENTS.has(event)) return res.status(400).json({ message: 'Desteklenmeyen SUD event.' });
  if (!mgId || !data || typeof data !== 'object' || Array.isArray(data)) return res.status(400).json({ message: 'mgId ve data zorunludur.' });

  // Prevent a normal client from impersonating another Lymix user in single-user events.
  if (['user_in', 'user_out', 'user_ready'].includes(event) && data.uid && String(data.uid) !== String(req.auth.sub) && req.auth.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ message: 'Başka kullanıcı adına oyun eventi gönderilemez.' });
  }
  try {
    const result = await sudApi.pushEvent({ event, mgId, data });
    return res.json(result);
  } catch (error) {
    return sudApiError(res, error, 'SUD_PUSH_EVENT_FAILED');
  }
});

app.post('/api/games/sud/callback/get_sstoken', sudCallbackSecurity, (req, res) => {
  if (!sudReady()) return sudFailure(res, 1005, 'SUD auth unavailable');
  try {
    const code = String(req.body?.code || '');
    if (!code) return sudFailure(res, 1005, 'code required');
    const uidResult = sudAuth.getUidByCode(code);
    const uid = String(uidResult?.uid || '');
    if (!uidResult?.isSuccess || !uid) return sudFailure(res, normalizeSudError(uidResult));
    const ss = sudAuth.getSSToken(uid, SUD_SSTOKEN_TTL_MS);
    if (!ss?.token) return sudFailure(res, 1005);
    return res.status(200).json({
      ret_code: 0,
      ret_msg: '',
      sdk_error_code: 0,
      data: { ss_token: ss.token, expire_date: Number(ss.expireDate || 0), expire_date_str: String(ss.expireDate || ''), user_info: sudUserInfo(uid) }
    });
  } catch (error) {
    console.error('SUD get_sstoken failed:', error);
    return sudFailure(res, 1005);
  }
});

app.post('/api/games/sud/callback/update_sstoken', sudCallbackSecurity, (req, res) => {
  if (!sudReady()) return sudFailure(res, 1005, 'SUD auth unavailable');
  try {
    const oldToken = String(req.body?.ss_token || '');
    if (!oldToken) return sudFailure(res, 1005, 'ss_token required');
    const uidResult = sudAuth.getUidBySSToken(oldToken);
    const uid = String(uidResult?.uid || '');
    if (!uidResult?.isSuccess || !uid) return sudFailure(res, normalizeSudError(uidResult));
    const ss = sudAuth.getSSToken(uid, SUD_SSTOKEN_TTL_MS);
    if (!ss?.token) return sudFailure(res, 1005);
    return res.status(200).json({ ret_code: 0, ret_msg: '', sdk_error_code: 0, data: { ss_token: ss.token, expire_date: Number(ss.expireDate || 0) } });
  } catch (error) {
    console.error('SUD update_sstoken failed:', error);
    return sudFailure(res, 1005);
  }
});

app.post('/api/games/sud/callback/get_user_info', sudCallbackSecurity, (req, res) => {
  if (!sudReady()) return sudFailure(res, 1005, 'SUD auth unavailable');
  try {
    const ssToken = String(req.body?.ss_token || '');
    if (!ssToken) return sudFailure(res, 1005, 'ss_token required');
    const uidResult = sudAuth.getUidBySSToken(ssToken);
    const uid = String(uidResult?.uid || '');
    if (!uidResult?.isSuccess || !uid) return sudFailure(res, normalizeSudError(uidResult));
    return res.status(200).json({ ret_code: 0, ret_msg: '', sdk_error_code: 0, data: sudUserInfo(uid) });
  } catch (error) {
    console.error('SUD get_user_info failed:', error);
    return sudFailure(res, 1005);
  }
});

app.listen(PORT, '0.0.0.0', () => console.log(`LYMIX backend listening on ${PORT}`));
