'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const {
  otpLogin,
  resetPassword,
  changePassword,
  listSessions,
  revokeSession,
  setOwnDeviceTrusted
} = require('./auth_service');

function auth(req, res, next) {
  try {
    const raw = String(req.headers.authorization || '');
    const token = raw.startsWith('Bearer ') ? raw.slice(7) : '';
    req.auth = jwt.verify(token, String(process.env.JWT_SECRET || ''), { issuer: 'lymix', audience: 'lymix-app' });
    next();
  } catch (_) {
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Yetkisiz.' });
  }
}

function deviceFrom(req) {
  return {
    deviceKey: req.body?.deviceKey,
    platform: req.body?.platform,
    deviceName: req.body?.deviceName,
    appVersion: req.body?.appVersion,
    userAgent: req.get('user-agent') || null,
    ip: req.ip
  };
}

function fail(res, error) {
  const code = String(error?.message || 'UNKNOWN_ERROR');
  const statuses = {
    INVALID_CREDENTIALS: 401,
    USER_NOT_ACTIVE: 403,
    DEVICE_BANNED: 403,
    DEVICE_NOT_FOUND: 404,
    DEVICE_KEY_REQUIRED: 400,
    OTP_NOT_FOUND: 400,
    OTP_EXPIRED: 400,
    OTP_INVALID: 400,
    OTP_TOO_MANY_ATTEMPTS: 429,
    PASSWORD_REUSE_NOT_ALLOWED: 409
  };
  const status = statuses[code] || (error?.name === 'ZodError' ? 400 : 500);
  return res.status(status).json({ code, message: status >= 500 ? 'İşlem tamamlanamadı.' : code });
}

function createExtendedAuthRouter() {
  const router = express.Router();
  const limiter = rateLimit({ windowMs: 10 * 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });

  router.post('/auth/login/otp', limiter, async (req, res) => {
    try {
      return res.json(await otpLogin({ phoneE164: req.body?.phoneE164, code: req.body?.otpCode, device: deviceFrom(req) }));
    } catch (error) { return fail(res, error); }
  });

  router.post('/auth/password/reset', limiter, async (req, res) => {
    try {
      return res.json(await resetPassword({ phoneE164: req.body?.phoneE164, code: req.body?.otpCode, newPassword: req.body?.newPassword }));
    } catch (error) { return fail(res, error); }
  });

  router.post('/auth/password/change', auth, async (req, res) => {
    try {
      return res.json(await changePassword({
        userId: req.auth.sub,
        currentPassword: req.body?.currentPassword,
        newPassword: req.body?.newPassword,
        keepSessionId: req.auth.sid
      }));
    } catch (error) { return fail(res, error); }
  });

  router.get('/sessions', auth, async (req, res) => {
    try {
      const sessions = await listSessions(req.auth.sub);
      return res.json(sessions.map((s) => ({ ...s, current: s.id === req.auth.sid })));
    } catch (error) { return fail(res, error); }
  });

  router.delete('/sessions/:sessionId', auth, async (req, res) => {
    try {
      await revokeSession({ sessionId: req.params.sessionId, userId: req.auth.sub, reason: 'user_revoked_session' });
      return res.json({ ok: true });
    } catch (error) { return fail(res, error); }
  });

  router.patch('/devices/:deviceId/trusted', auth, async (req, res) => {
    try {
      return res.json(await setOwnDeviceTrusted({ userId: req.auth.sub, deviceId: req.params.deviceId, trusted: req.body?.trusted !== false }));
    } catch (error) { return fail(res, error); }
  });

  return router;
}

module.exports = { createExtendedAuthRouter };
