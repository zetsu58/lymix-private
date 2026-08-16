'use strict';

const DEFAULT_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;
const MIN_TOKEN_TTL_MS = 30 * 60 * 1000;
const MAX_UID_BYTES = 200;

class SudAuthAdapter {
  constructor({ appId, appSecret }) {
    this.appId = String(appId || '');
    this.appSecret = String(appSecret || '');
    this.sdk = null;
    this.loadError = null;
    if (!this.appId || !this.appSecret) return;
    try {
      const mod = require('@sudtechnology/sud-mgp-auth-node');
      if (!mod || typeof mod.NewSudMGPAuth !== 'function') throw new Error('SUD SDK does not export NewSudMGPAuth');
      this.sdk = mod.NewSudMGPAuth(this.appId, this.appSecret);
    } catch (error) { this.loadError = error; }
  }
  get available() { return Boolean(this.sdk); }
  get status() {
    return { available: this.available, reason: this.available ? null : (this.loadError?.code || this.loadError?.message || 'SUD_SDK_NOT_CONFIGURED'), tokenDefaults: { defaultTtlMs: DEFAULT_TOKEN_TTL_MS, minimumTtlMs: MIN_TOKEN_TTL_MS, maxUidBytes: MAX_UID_BYTES } };
  }
  assertSdk() { if (!this.sdk) throw new Error('SUD_AUTH_SDK_UNAVAILABLE'); }
  normalizeUid(uid) {
    const value = String(uid || '');
    if (!value) throw new Error('SUD_UID_REQUIRED');
    if (Buffer.byteLength(value, 'utf8') > MAX_UID_BYTES) throw new Error('SUD_UID_TOO_LONG');
    return value;
  }
  normalizeTtl(expireDurationMs = 0) {
    const requested = Number(expireDurationMs || 0);
    if (!Number.isFinite(requested) || requested < 0) throw new Error('SUD_INVALID_TOKEN_TTL');
    if (requested === 0) return 0;
    return Math.max(Math.trunc(requested), MIN_TOKEN_TTL_MS);
  }
  normalizeUidResult(result) {
    const raw = result && typeof result === 'object' ? result : {};
    const errorCode = Number(raw.errorCode ?? raw.sdkErrorCode ?? raw.sdk_error_code ?? (raw.isSuccess ? 0 : 1004));
    return { ...raw, uid: String(raw.uid || ''), isSuccess: Boolean(raw.isSuccess), errorCode, sdkErrorCode: errorCode, sdk_error_code: errorCode };
  }
  getCode(uid, expireDurationMs = 0) { this.assertSdk(); return this.sdk.getCode(this.normalizeUid(uid), this.normalizeTtl(expireDurationMs)); }
  getUidByCode(code) { this.assertSdk(); const value = String(code || ''); if (!value) return this.normalizeUidResult({ uid: '', isSuccess: false, errorCode: 1004 }); return this.normalizeUidResult(this.sdk.getUidByCode(value)); }
  getSSToken(uid, expireDurationMs = 0) { this.assertSdk(); return this.sdk.getSSToken(this.normalizeUid(uid), this.normalizeTtl(expireDurationMs)); }
  getUidBySSToken(ssToken) { this.assertSdk(); const value = String(ssToken || ''); if (!value) return this.normalizeUidResult({ uid: '', isSuccess: false, errorCode: 1004 }); return this.normalizeUidResult(this.sdk.getUidBySSToken(value)); }
  verifyCode(code) { this.assertSdk(); const value = String(code || ''); if (!value) return 1004; if (typeof this.sdk.verifyCode !== 'function') throw new Error('SUD_VERIFY_CODE_UNAVAILABLE'); return Number(this.sdk.verifyCode(value)); }
  verifySSToken(ssToken) { this.assertSdk(); const value = String(ssToken || ''); if (!value) return 1004; if (typeof this.sdk.verifySSToken !== 'function') throw new Error('SUD_VERIFY_SSTOKEN_UNAVAILABLE'); return Number(this.sdk.verifySSToken(value)); }
}

const SUD_AUTH_ERROR_CODES = Object.freeze({ 0: 'SUCCESS', 1001: 'TOKEN_CREATE_FAILED', 1002: 'TOKEN_VERIFY_FAILED', 1003: 'TOKEN_DECODE_FAILED', 1004: 'TOKEN_INVALID', 1005: 'TOKEN_EXPIRED' });

module.exports = { SudAuthAdapter, SUD_AUTH_ERROR_CODES, DEFAULT_TOKEN_TTL_MS, MIN_TOKEN_TTL_MS, MAX_UID_BYTES };
