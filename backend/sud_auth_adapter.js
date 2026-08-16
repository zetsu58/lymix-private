'use strict';

/**
 * Thin adapter around SUD's official Node server SDK.
 *
 * The package is distributed from GitHub Packages and requires SUD-granted access:
 *   npm install @sudtechnology/sud-mgp-auth-node
 *
 * We load it lazily so Lymix can still boot before SUD grants package access.
 */
class SudAuthAdapter {
  constructor({ appId, appSecret }) {
    this.appId = String(appId || '');
    this.appSecret = String(appSecret || '');
    this.sdk = null;
    this.loadError = null;

    if (!this.appId || !this.appSecret) return;

    try {
      // eslint-disable-next-line global-require, import/no-extraneous-dependencies
      const mod = require('@sudtechnology/sud-mgp-auth-node');
      if (!mod || typeof mod.NewSudMGPAuth !== 'function') {
        throw new Error('SUD SDK does not export NewSudMGPAuth');
      }
      this.sdk = mod.NewSudMGPAuth(this.appId, this.appSecret);
    } catch (error) {
      this.loadError = error;
    }
  }

  get available() {
    return Boolean(this.sdk);
  }

  get status() {
    return {
      available: this.available,
      reason: this.available ? null : (this.loadError?.code || this.loadError?.message || 'SUD_SDK_NOT_CONFIGURED')
    };
  }

  getCode(uid, expireDurationMs = 0) {
    if (!this.sdk) throw new Error('SUD_AUTH_SDK_UNAVAILABLE');
    return this.sdk.getCode(String(uid), Number(expireDurationMs || 0));
  }

  getUidByCode(code) {
    if (!this.sdk) throw new Error('SUD_AUTH_SDK_UNAVAILABLE');
    return this.sdk.getUidByCode(String(code));
  }

  getSSToken(uid, expireDurationMs = 0) {
    if (!this.sdk) throw new Error('SUD_AUTH_SDK_UNAVAILABLE');
    return this.sdk.getSSToken(String(uid), Number(expireDurationMs || 0));
  }

  getUidBySSToken(ssToken) {
    if (!this.sdk) throw new Error('SUD_AUTH_SDK_UNAVAILABLE');
    return this.sdk.getUidBySSToken(String(ssToken));
  }
}

module.exports = { SudAuthAdapter };
