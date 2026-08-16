'use strict';

async function sendOtp({ phoneE164, code, purpose }) {
  const webhook = String(process.env.SMS_WEBHOOK_URL || '');
  const token = String(process.env.SMS_WEBHOOK_TOKEN || '');

  if (webhook) {
    const response = await fetch(webhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ phoneE164, code, purpose, app: 'Lymix' })
    });
    if (!response.ok) throw new Error(`SMS_PROVIDER_HTTP_${response.status}`);
    return { provider: 'webhook' };
  }

  if (process.env.NODE_ENV !== 'production' && String(process.env.ALLOW_DEV_OTP || 'false').toLowerCase() === 'true') {
    console.warn(`[DEV OTP] ${phoneE164} ${purpose}: ${code}`);
    return { provider: 'development' };
  }

  throw new Error('SMS_PROVIDER_NOT_CONFIGURED');
}

module.exports = { sendOtp };
