'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { requestOtp, register, passwordLogin, refreshSession, revokeSession, revokeAllSessions, listDevices } = require('./auth_service');
const { sendOtp } = require('./otp_provider');
const { getProfile, getPublicProfile, updateProfile } = require('./profile_service');
const { getWallet, listLedger, postLedgerEntry } = require('./ledger_service');
const { recordRoomGameSession, closeRoomGameSession } = require('./sud_settlement_service');
const { getMetrics, listUsers, setUserStatus, setUserRole, setDeviceBan, listAudit } = require('./admin_service');

function publicError(error) {
  const code = String(error?.message || 'UNKNOWN_ERROR');
  const status = {
    INVALID_CREDENTIALS: 401,
    REFRESH_INVALID: 401,
    REFRESH_REPLAY_DETECTED: 401,
    SESSION_BLOCKED: 403,
    DEVICE_BANNED: 403,
    DEVICE_KEY_REQUIRED: 400,
    OTP_NOT_FOUND: 400,
    OTP_EXPIRED: 400,
    OTP_INVALID: 400,
    OTP_PURPOSE_INVALID: 400,
    OTP_TOO_MANY_ATTEMPTS: 429,
    OTP_COOLDOWN: 429,
    USER_ALREADY_EXISTS: 409,
    INSUFFICIENT_BALANCE: 409,
    USER_NOT_FOUND: 404,
    USER_NOT_ACTIVE: 403,
    USER_STATUS_INVALID: 400,
    USER_ROLE_INVALID: 400,
    JWT_SECRET_NOT_CONFIGURED: 503,
    OTP_PEPPER_NOT_CONFIGURED: 503,
    SMS_PROVIDER_NOT_CONFIGURED: 503
  }[code] || (error?.name === 'ZodError' ? 400 : 500);
  return { status, body: { code, message: status >= 500 ? 'İşlem tamamlanamadı.' : code } };
}

function createAuthMiddleware() {
  const secret = String(process.env.JWT_SECRET || '');
  return (req, res, next) => {
    const raw = String(req.headers.authorization || '');
    const token = raw.startsWith('Bearer ') ? raw.slice(7) : '';
    try {
      const claims = jwt.verify(token, secret, { issuer: 'lymix', audience: 'lymix-app' });
      req.auth = claims;
      next();
    } catch (_) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'Yetkisiz.' });
    }
  };
}

function requireSuperAdmin(req, res, next) {
  if (req.auth?.role !== 'SUPER_ADMIN') return res.status(403).json({ code: 'SUPER_ADMIN_REQUIRED' });
  next();
}

function createProductionCoreRouter() {
  const router = express.Router();
  const requireAuth = createAuthMiddleware();
  const otpLimiter = rateLimit({ windowMs: 10 * 60_000, limit: 5, standardHeaders: true, legacyHeaders: false });
  const loginLimiter = rateLimit({ windowMs: 10 * 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });

  router.get('/health', async (_req, res) => res.json({ ok: true, module: 'production-core' }));

  router.post('/auth/otp/request', otpLimiter, async (req, res) => {
    try {
      const phoneE164 = String(req.body?.phoneE164 || '');
      const purpose = String(req.body?.purpose || 'REGISTER').toUpperCase();
      const result = await requestOtp({ phoneE164, purpose });
      await sendOtp({ phoneE164, code: result.code, purpose });
      return res.status(202).json({ ok: true, expiresInSeconds: result.expiresInSeconds });
    } catch (error) {
      const out = publicError(error);
      return res.status(out.status).json(out.body);
    }
  });

  router.post('/auth/register', loginLimiter, async (req, res) => {
    try {
      const device = {
        deviceKey: req.body?.deviceKey,
        platform: req.body?.platform,
        deviceName: req.body?.deviceName,
        appVersion: req.body?.appVersion,
        otpCode: req.body?.otpCode,
        userAgent: req.get('user-agent') || null,
        ip: req.ip
      };
      const result = await register({
        phoneE164: req.body?.phoneE164,
        username: req.body?.username,
        password: req.body?.password,
        displayName: req.body?.displayName,
        device
      });
      return res.status(201).json(result);
    } catch (error) {
      const out = publicError(error);
      return res.status(out.status).json(out.body);
    }
  });

  router.post('/auth/login', loginLimiter, async (req, res) => {
    try {
      const result = await passwordLogin({
        login: req.body?.login,
        password: req.body?.password,
        device: {
          deviceKey: req.body?.deviceKey,
          platform: req.body?.platform,
          deviceName: req.body?.deviceName,
          appVersion: req.body?.appVersion,
          userAgent: req.get('user-agent') || null,
          ip: req.ip
        }
      });
      return res.json(result);
    } catch (error) {
      const out = publicError(error);
      return res.status(out.status).json(out.body);
    }
  });

  router.post('/auth/refresh', loginLimiter, async (req, res) => {
    try { return res.json(await refreshSession(String(req.body?.refreshToken || ''))); }
    catch (error) { const out = publicError(error); return res.status(out.status).json(out.body); }
  });

  router.post('/auth/logout', requireAuth, async (req, res) => {
    await revokeSession({ sessionId: String(req.auth.sid || ''), userId: String(req.auth.sub), reason: 'logout' });
    return res.json({ ok: true });
  });

  router.post('/auth/logout-all', requireAuth, async (req, res) => {
    await revokeAllSessions(String(req.auth.sub), req.body?.keepCurrent ? String(req.auth.sid || '') : null);
    return res.json({ ok: true });
  });

  router.get('/me', requireAuth, async (req, res) => {
    try { return res.json(await getProfile(String(req.auth.sub))); }
    catch (error) { const out = publicError(error); return res.status(out.status).json(out.body); }
  });

  router.patch('/me', requireAuth, async (req, res) => {
    try { return res.json(await updateProfile(String(req.auth.sub), req.body)); }
    catch (error) { const out = publicError(error); return res.status(out.status).json(out.body); }
  });

  router.get('/users/:userId/profile', requireAuth, async (req, res) => {
    try { return res.json(await getPublicProfile(req.params.userId)); }
    catch (error) { const out = publicError(error); return res.status(out.status).json(out.body); }
  });

  router.get('/devices', requireAuth, async (req, res) => {
    const rows = await listDevices(String(req.auth.sub));
    return res.json(rows.map((d) => ({ id: d.id, deviceKey: d.deviceKey, platform: d.platform, deviceName: d.deviceName, appVersion: d.appVersion, trusted: d.trusted, banned: d.banned, firstSeenAt: d.firstSeenAt, lastSeenAt: d.lastSeenAt })));
  });

  router.get('/wallet', requireAuth, async (req, res) => res.json(await getWallet(String(req.auth.sub))));
  router.get('/wallet/ledger', requireAuth, async (req, res) => res.json(await listLedger(String(req.auth.sub), { take: req.query.take, cursor: req.query.cursor })));

  router.post('/games/sud/session/join', requireAuth, async (req, res) => {
    try {
      const row = await recordRoomGameSession({ userId: req.auth.sub, roomId: req.body?.roomId, mgId: req.body?.mgId, gameRoundId: req.body?.gameRoundId, metadata: req.body?.metadata });
      return res.status(201).json(row);
    } catch (error) { const out = publicError(error); return res.status(out.status).json(out.body); }
  });

  router.post('/games/sud/session/leave', requireAuth, async (req, res) => {
    try {
      const row = await closeRoomGameSession({ userId: req.auth.sub, roomId: req.body?.roomId, mgId: req.body?.mgId });
      return res.json({ ok: true, session: row });
    } catch (error) { const out = publicError(error); return res.status(out.status).json(out.body); }
  });

  router.get('/admin/metrics', requireAuth, requireSuperAdmin, async (_req, res) => res.json(await getMetrics()));
  router.get('/admin/users', requireAuth, requireSuperAdmin, async (req, res) => {
    const rows = await listUsers({ take: req.query.take, cursor: req.query.cursor, q: req.query.q, status: req.query.status, role: req.query.role });
    return res.json(rows.map((u) => ({ ...u, wallet: u.wallet ? { ...u.wallet, balance: u.wallet.balance.toString() } : null })));
  });
  router.patch('/admin/users/:userId/status', requireAuth, requireSuperAdmin, async (req, res) => {
    try { return res.json(await setUserStatus({ actorId: req.auth.sub, userId: req.params.userId, status: req.body?.status, reason: req.body?.reason })); }
    catch (error) { const out = publicError(error); return res.status(out.status).json(out.body); }
  });
  router.patch('/admin/users/:userId/role', requireAuth, requireSuperAdmin, async (req, res) => {
    try { return res.json(await setUserRole({ actorId: req.auth.sub, userId: req.params.userId, role: req.body?.role })); }
    catch (error) { const out = publicError(error); return res.status(out.status).json(out.body); }
  });
  router.patch('/admin/devices/:deviceId/ban', requireAuth, requireSuperAdmin, async (req, res) => {
    try { return res.json(await setDeviceBan({ actorId: req.auth.sub, deviceId: req.params.deviceId, banned: req.body?.banned !== false, reason: req.body?.reason })); }
    catch (error) { const out = publicError(error); return res.status(out.status).json(out.body); }
  });
  router.get('/admin/audit', requireAuth, requireSuperAdmin, async (req, res) => res.json(await listAudit({ take: req.query.take, cursor: req.query.cursor, action: req.query.action })));

  router.post('/admin/wallet/adjust', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const result = await postLedgerEntry({
        userId: String(req.body?.userId || ''),
        idempotencyKey: String(req.body?.idempotencyKey || ''),
        direction: req.body?.direction,
        amount: req.body?.amount,
        source: 'ADMIN_ADJUSTMENT',
        externalRef: req.body?.externalRef,
        metadata: { actorId: String(req.auth.sub), reason: req.body?.reason || null }
      });
      return res.json({ ...result, entry: { ...result.entry, amount: result.entry.amount.toString(), balanceBefore: result.entry.balanceBefore.toString(), balanceAfter: result.entry.balanceAfter.toString() } });
    } catch (error) {
      const out = publicError(error);
      return res.status(out.status).json(out.body);
    }
  });

  return router;
}

module.exports = { createProductionCoreRouter, createAuthMiddleware };
