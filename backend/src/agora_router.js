'use strict';

const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { RtcTokenBuilder, RtcRole } = require('agora-token');
const { createAuthMiddleware } = require('./production_core_router');

function cleanRoomId(value) {
  const roomId = String(value || '').trim();
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(roomId)) throw new Error('ROOM_ID_INVALID');
  return roomId;
}

function buildChannelName(roomId) {
  const clean = cleanRoomId(roomId);
  const direct = `lymix_${clean}`;
  if (Buffer.byteLength(direct, 'utf8') <= 64) return direct;
  const digest = crypto.createHash('sha256').update(clean).digest('hex').slice(0, 40);
  return `lymix_${digest}`;
}

function createAgoraRouter() {
  const router = express.Router();
  const requireAuth = createAuthMiddleware();
  const limiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });

  router.get('/agora/status', requireAuth, (_req, res) => {
    return res.json({
      configured: Boolean(process.env.AGORA_APP_ID && process.env.AGORA_APP_CERTIFICATE),
      tokenAuth: true
    });
  });

  router.post('/agora/rtc-token', requireAuth, limiter, (req, res) => {
    try {
      const appId = String(process.env.AGORA_APP_ID || '');
      const certificate = String(process.env.AGORA_APP_CERTIFICATE || '');
      if (!appId || !certificate) {
        return res.status(503).json({ code: 'AGORA_NOT_CONFIGURED', message: 'Agora App ID/Certificate yapılandırılmadı.' });
      }

      const channelName = buildChannelName(req.body?.roomId);
      const account = String(req.auth.sub);
      const requested = Number(process.env.AGORA_TOKEN_TTL_SECONDS || 3600);
      const ttlSeconds = Number.isFinite(requested) ? Math.max(300, Math.min(7200, Math.trunc(requested))) : 3600;
      const token = RtcTokenBuilder.buildTokenWithUserAccount(
        appId,
        certificate,
        channelName,
        account,
        RtcRole.PUBLISHER,
        ttlSeconds,
        ttlSeconds
      );

      return res.json({
        appId,
        token,
        channelName,
        userAccount: account,
        expiresInSeconds: ttlSeconds
      });
    } catch (error) {
      const code = String(error?.message || 'AGORA_TOKEN_FAILED');
      const status = code === 'ROOM_ID_INVALID' ? 400 : 500;
      return res.status(status).json({ code, message: status === 500 ? 'Agora token üretilemedi.' : code });
    }
  });

  return router;
}

module.exports = { createAgoraRouter, cleanRoomId, buildChannelName };
