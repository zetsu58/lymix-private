'use strict';

const express = require('express');
const { createProductionCoreRouter } = require('./src/production_core_router');
const { createExtendedAuthRouter } = require('./src/auth_extended_router');
const { getProfile, getSudUserInfo } = require('./src/profile_service');
const { getSudAccount, applySudScoreUpdate, safeScore } = require('./src/sud_settlement_service');
const { SudAuthAdapter } = require('./sud_auth_adapter');

const sudAuth = new SudAuthAdapter({ appId: process.env.SUD_APP_ID, appSecret: process.env.SUD_APP_SECRET });
const ssTokenTtlMs = Number(process.env.SUD_SSTOKEN_TTL_MS || 0);

function sudFailure(res, sdkErrorCode = 0, retCode = 1, message = '') {
  return res.status(200).json({ ret_code: retCode, ret_msg: message, ...(sdkErrorCode ? { sdk_error_code: sdkErrorCode } : {}), data: {} });
}

function uidErrorCode(result) {
  return Number(result?.sdkErrorCode ?? result?.errorCode ?? result?.sdk_error_code ?? 1005);
}

async function realGetSSToken(req, res) {
  try {
    if (!sudAuth.available) return sudFailure(res, 1005, 1, 'SUD auth unavailable');
    const code = String(req.body?.code || '');
    const resolved = sudAuth.getUidByCode(code);
    if (!resolved?.isSuccess || !resolved.uid) return sudFailure(res, uidErrorCode(resolved));
    const userInfo = await getSudUserInfo(resolved.uid);
    const token = sudAuth.getSSToken(resolved.uid, ssTokenTtlMs);
    if (!token?.token) return sudFailure(res, 1001);
    return res.json({
      ret_code: 0,
      ret_msg: '',
      sdk_error_code: 0,
      data: {
        ss_token: token.token,
        expire_date: Number(token.expireDate || 0),
        expire_date_str: String(token.expireDate || ''),
        user_info: userInfo
      }
    });
  } catch (error) {
    console.error('SUD real get_sstoken failed:', error);
    return sudFailure(res, 1005);
  }
}

async function realGetUserInfo(req, res) {
  try {
    if (!sudAuth.available) return sudFailure(res, 1005, 1, 'SUD auth unavailable');
    const resolved = sudAuth.getUidBySSToken(String(req.body?.ss_token || ''));
    if (!resolved?.isSuccess || !resolved.uid) return sudFailure(res, uidErrorCode(resolved));
    return res.json({ ret_code: 0, ret_msg: '', sdk_error_code: 0, data: await getSudUserInfo(resolved.uid) });
  } catch (error) {
    console.error('SUD real get_user_info failed:', error);
    return sudFailure(res, 1005);
  }
}

async function realGetScore(req, res) {
  try {
    const account = await getSudAccount(String(req.body?.uid || ''));
    return res.json({ ret_code: 0, ret_msg: 'success', data: { score: account.score } });
  } catch (error) {
    console.error('SUD get_score failed:', error);
    return sudFailure(res, 0, 1, String(error.message || 'failure'));
  }
}

async function realGetAccount(req, res) {
  try {
    const uid = String(req.body?.uid || '');
    const [account, user] = await Promise.all([getSudAccount(uid), getProfile(uid)]);
    const vip = Math.max(0, Math.min(Number(user.profile?.vipLevel || 0), 3));
    return res.json({
      ret_code: 0,
      ret_msg: 'success',
      data: {
        nickname: user.profile?.displayName || user.username || `Lymix ${uid.slice(-6)}`,
        avatar_url: user.profile?.avatarUrl || '',
        score: account.score,
        vip_level: vip
      }
    });
  } catch (error) {
    console.error('SUD get_account failed:', error);
    return sudFailure(res, 0, 1, String(error.message || 'failure'));
  }
}

async function realUpdateScore(req, res) {
  try {
    const result = await applySudScoreUpdate(req.body || {});
    if (result.duplicate) return sudFailure(res, 0, 9001, 'duplicate order id');
    return res.json({ ret_code: 0, ret_msg: 'success', data: { score: safeScore(result.wallet.balance) } });
  } catch (error) {
    if (String(error.message) === 'INSUFFICIENT_BALANCE') return sudFailure(res, 0, 9000, 'insufficient balance');
    console.error('SUD update_score failed:', error);
    return sudFailure(res, 0, 1, String(error.message || 'failure'));
  }
}

const originalPost = express.application.post;
express.application.post = function lymixProductionPost(path, ...handlers) {
  const replacements = {
    '/api/games/sud/callback/get_sstoken': realGetSSToken,
    '/api/games/sud/callback/get_user_info': realGetUserInfo,
    '/api/games/sud/callback/get_score': realGetScore,
    '/api/games/sud/callback/get_account': realGetAccount,
    '/api/games/sud/callback/update_score': realUpdateScore
  };
  if (typeof path === 'string' && replacements[path] && handlers.length) {
    handlers[handlers.length - 1] = replacements[path];
  }
  return originalPost.call(this, path, ...handlers);
};

const originalListen = express.application.listen;
let mounted = false;
express.application.listen = function lymixProductionListen(...args) {
  if (!mounted) {
    this.use('/api/v1', createProductionCoreRouter());
    this.use('/api/v1', createExtendedAuthRouter());
    mounted = true;
  }
  return originalListen.apply(this, args);
};

require('./server');
