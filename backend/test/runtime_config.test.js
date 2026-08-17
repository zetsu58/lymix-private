'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { publicMobileConfig } = require('../src/runtime_router');

function withEnv(values, fn) {
  const previous = {};
  for (const [key, value] of Object.entries(values)) {
    previous[key] = process.env[key];
    if (value == null) delete process.env[key];
    else process.env[key] = String(value);
  }
  try { return fn(); }
  finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('mobile config never exposes provider secrets and defaults safely', () => {
  withEnv({
    AGORA_APP_ID: null,
    AGORA_APP_CERTIFICATE: null,
    SUD_APP_ID: null,
    SUD_APP_KEY: null,
    SUD_APP_SECRET: null,
    LYMIX_MAINTENANCE_MODE: null
  }, () => {
    const cfg = publicMobileConfig();
    assert.equal(cfg.maintenance, false);
    assert.equal(cfg.features.agoraVoice, false);
    assert.equal(cfg.features.sudGames, false);
    assert.equal(JSON.stringify(cfg).includes('APP_CERTIFICATE'), false);
    assert.equal(JSON.stringify(cfg).includes('SUD_APP_SECRET'), false);
  });
});

test('mobile config enables providers only when credentials are complete', () => {
  withEnv({
    AGORA_APP_ID: 'a',
    AGORA_APP_CERTIFICATE: 'b',
    SUD_APP_ID: '1',
    SUD_APP_KEY: '2',
    SUD_APP_SECRET: '3',
    SUD_LEDGER_READY: 'true'
  }, () => {
    const cfg = publicMobileConfig();
    assert.equal(cfg.features.agoraVoice, true);
    assert.equal(cfg.features.sudGames, true);
    assert.equal(cfg.features.sudLedgerReady, true);
  });
});
