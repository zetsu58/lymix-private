'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { exportMyData, deleteMyAccount } = require('./privacy_service');

function auth(req, res, next) {
  try {
    const raw = String(req.headers.authorization || '');
    const token = raw.startsWith('Bearer ') ? raw.slice(7) : '';
    req.auth = jwt.verify(token, String(process.env.JWT_SECRET || ''), { issuer: 'lymix', audience: 'lymix-app' });
    next();
  } catch (_) {
    res.status(401).json({ code: 'UNAUTHORIZED' });
  }
}

function createPrivacyRouter() {
  const router = express.Router();
  const sensitiveLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false });

  router.get('/me/export', auth, sensitiveLimiter, async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      return res.json(await exportMyData(req.auth.sub));
    } catch (error) {
      const code = String(error?.message || 'EXPORT_FAILED');
      return res.status(code === 'USER_NOT_FOUND' ? 404 : 500).json({ code });
    }
  });

  router.delete('/me', auth, sensitiveLimiter, async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      return res.json(await deleteMyAccount({ userId: req.auth.sub, password: req.body?.password }));
    } catch (error) {
      const code = String(error?.message || 'ACCOUNT_DELETE_FAILED');
      const status = code === 'INVALID_CREDENTIALS' ? 401 : code === 'SUPER_ADMIN_DELETE_BLOCKED' ? 403 : code === 'USER_NOT_FOUND' ? 404 : 500;
      return res.status(status).json({ code, message: status >= 500 ? 'Hesap silinemedi.' : code });
    }
  });

  return router;
}

module.exports = { createPrivacyRouter };
