'use strict';

const base = String(process.env.LYMIX_SMOKE_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');

async function call(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let body = text;
  try { body = text ? JSON.parse(text) : null; } catch (_) {}
  if (!response.ok) {
    throw new Error(`${path} -> HTTP ${response.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }
  console.log(`PASS ${path} (${response.status})`);
  return body;
}

async function main() {
  await call('/api/v1/health');
  await call('/api/v1/runtime/config');
  await call('/api/v1/ready');

  const login = process.env.LYMIX_SMOKE_LOGIN;
  const password = process.env.LYMIX_SMOKE_PASSWORD;
  if (!login || !password) {
    console.log('SKIP authenticated smoke checks (set LYMIX_SMOKE_LOGIN and LYMIX_SMOKE_PASSWORD).');
    return;
  }

  const auth = await call('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      login,
      password,
      deviceKey: process.env.LYMIX_SMOKE_DEVICE_KEY || 'smoke-device',
      platform: 'smoke',
      deviceName: 'Backend Smoke Test',
      appVersion: '21.22.0'
    })
  });

  if (!auth?.accessToken) throw new Error('Login response did not contain accessToken.');
  const bearer = { Authorization: `Bearer ${auth.accessToken}` };
  await call('/api/v1/me', { headers: bearer });
  await call('/api/v1/wallet', { headers: bearer });
  await call('/api/v1/devices', { headers: bearer });
  await call('/api/v1/sessions', { headers: bearer });
  await call('/api/v1/agora/status', { headers: bearer });
  await call('/api/games/sud/status', { headers: bearer });
}

main().catch((error) => {
  console.error(`SMOKE FAILED: ${error.message}`);
  process.exit(1);
});
