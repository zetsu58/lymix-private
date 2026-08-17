'use strict';

function value(name) { return String(process.env[name] || ''); }
function enabled(name, fallback = false) {
  if (!Object.prototype.hasOwnProperty.call(process.env, name)) return fallback;
  return value(name).toLowerCase() === 'true';
}

const isProduction = value('NODE_ENV') === 'production';
const errors = [];
const warnings = [];

if (!value('DATABASE_URL').startsWith('postgresql://')) errors.push('DATABASE_URL must be a postgresql:// URL.');
if (value('JWT_SECRET').length < 32) errors.push('JWT_SECRET must be at least 32 characters.');
if (value('OTP_PEPPER').length < 16) errors.push('OTP_PEPPER must be at least 16 characters.');
if (isProduction && enabled('ALLOW_DEV_OTP', false)) errors.push('ALLOW_DEV_OTP must be false in production.');

const agoraId = value('AGORA_APP_ID');
const agoraCertificate = value('AGORA_APP_CERTIFICATE');
if (Boolean(agoraId) !== Boolean(agoraCertificate)) {
  errors.push('AGORA_APP_ID and AGORA_APP_CERTIFICATE must be configured together.');
}
if (isProduction && !agoraId) warnings.push('Agora is not configured; voice-room token endpoint will remain unavailable.');

const sudConfigured = Boolean(value('SUD_APP_ID') && value('SUD_APP_KEY') && value('SUD_APP_SECRET'));
if (sudConfigured && isProduction && !enabled('SUD_VERIFY_CALLBACK_SIGNATURES', true)) {
  errors.push('SUD_VERIFY_CALLBACK_SIGNATURES must be true in production when SUD credentials exist.');
}
if ((enabled('SUD_ENABLE_ORDER_API') || enabled('SUD_ENABLE_BATCH_ORDER_API')) && !enabled('SUD_LEDGER_READY')) {
  errors.push('SUD order APIs cannot be enabled while SUD_LEDGER_READY=false.');
}
if (enabled('SUD_LEDGER_READY') && !sudConfigured) warnings.push('SUD_LEDGER_READY=true but SUD credentials are incomplete.');
if (isProduction && !value('SMS_WEBHOOK_URL')) warnings.push('SMS_WEBHOOK_URL is empty; OTP delivery will not work until a provider is configured.');

for (const warning of warnings) console.warn(`WARN: ${warning}`);
for (const error of errors) console.error(`ERROR: ${error}`);

if (errors.length) {
  console.error(`Runtime environment validation failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log(`Runtime environment validation passed (${isProduction ? 'production' : 'non-production'}).`);
