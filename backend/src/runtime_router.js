'use strict';

const express = require('express');
const { prisma } = require('./db');

function boolEnv(name, fallback = false) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  return String(raw).toLowerCase() === 'true';
}

function publicMobileConfig() {
  return {
    apiVersion: 'v1',
    maintenance: boolEnv('LYMIX_MAINTENANCE_MODE', false),
    maintenanceMessage: String(process.env.LYMIX_MAINTENANCE_MESSAGE || ''),
    versions: {
      androidMin: String(process.env.LYMIX_MIN_ANDROID_VERSION || '21.22.0'),
      androidLatest: String(process.env.LYMIX_LATEST_ANDROID_VERSION || '21.22.0'),
      iosMin: String(process.env.LYMIX_MIN_IOS_VERSION || '21.22.0'),
      iosLatest: String(process.env.LYMIX_LATEST_IOS_VERSION || '21.22.0')
    },
    features: {
      passwordLogin: true,
      otpLogin: true,
      registration: true,
      wallet: true,
      devices: true,
      sessions: true,
      accountExport: true,
      accountDelete: true,
      sudGames: Boolean(process.env.SUD_APP_ID && process.env.SUD_APP_KEY && process.env.SUD_APP_SECRET),
      sudTestEnv: boolEnv('SUD_IS_TEST_ENV', true),
      sudLedgerReady: boolEnv('SUD_LEDGER_READY', false)
    }
  };
}

function createRuntimeRouter() {
  const router = express.Router();

  router.get('/runtime/config', (_req, res) => {
    res.set('Cache-Control', 'public, max-age=60');
    return res.json(publicMobileConfig());
  });

  router.get('/ready', async (_req, res) => {
    const checks = { database: false, jwt: false, otp: false };
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch (_) {
      checks.database = false;
    }
    checks.jwt = String(process.env.JWT_SECRET || '').length >= 32;
    checks.otp = String(process.env.OTP_PEPPER || '').length >= 16;

    const ok = checks.database && checks.jwt && checks.otp;
    return res.status(ok ? 200 : 503).json({ ok, checks, time: new Date().toISOString() });
  });

  return router;
}

module.exports = { createRuntimeRouter, publicMobileConfig };
