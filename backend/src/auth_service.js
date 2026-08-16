'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { prisma } = require('./db');

const ACCESS_TTL = process.env.ACCESS_TOKEN_TTL || '15m';
const REFRESH_DAYS = Math.max(1, Number(process.env.REFRESH_TOKEN_DAYS || 30));
const OTP_TTL_MINUTES = Math.max(1, Number(process.env.OTP_TTL_MINUTES || 5));
const OTP_MAX_ATTEMPTS = Math.max(1, Number(process.env.OTP_MAX_ATTEMPTS || 5));
const JWT_SECRET = String(process.env.JWT_SECRET || '');
const OTP_PEPPER = String(process.env.OTP_PEPPER || JWT_SECRET || '');
const OTP_PURPOSES = new Set(['REGISTER', 'LOGIN', 'PASSWORD_RESET', 'PHONE_VERIFY']);

const phoneSchema = z.string().regex(/^\+[1-9]\d{7,14}$/);
const usernameSchema = z.string().min(3).max(32).regex(/^[a-zA-Z0-9_.]+$/);
const passwordSchema = z.string().min(8).max(128);

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function randomToken(bytes = 48) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

function normalizePurpose(purpose) {
  const value = String(purpose || 'LOGIN').toUpperCase();
  if (!OTP_PURPOSES.has(value)) throw new Error('OTP_PURPOSE_INVALID');
  return value;
}

function hashOtp(phone, purpose, code) {
  if (!OTP_PEPPER || OTP_PEPPER.length < 16) throw new Error('OTP_PEPPER_NOT_CONFIGURED');
  return crypto.createHmac('sha256', OTP_PEPPER).update(`${phone}\n${purpose}\n${code}`).digest('hex');
}

function signAccessToken(user, sessionId) {
  if (!JWT_SECRET || JWT_SECRET.length < 32) throw new Error('JWT_SECRET_NOT_CONFIGURED');
  return jwt.sign({ sub: user.id, role: user.role, sid: sessionId }, JWT_SECRET, {
    expiresIn: ACCESS_TTL,
    issuer: 'lymix',
    audience: 'lymix-app'
  });
}

async function requestOtp({ phoneE164, purpose }) {
  const phone = phoneSchema.parse(phoneE164);
  const normalizedPurpose = normalizePurpose(purpose);
  const code = generateOtp();
  const user = await prisma.user.findUnique({ where: { phoneE164: phone }, select: { id: true } });

  if (normalizedPurpose === 'REGISTER' && user) throw new Error('USER_ALREADY_EXISTS');
  if (normalizedPurpose !== 'REGISTER' && !user && normalizedPurpose !== 'PHONE_VERIFY') throw new Error('USER_NOT_FOUND');

  const recent = await prisma.otpChallenge.findFirst({
    where: { phoneE164: phone, purpose: normalizedPurpose, consumedAt: null, createdAt: { gte: new Date(Date.now() - 60_000) } },
    orderBy: { createdAt: 'desc' }
  });
  if (recent) throw new Error('OTP_COOLDOWN');

  await prisma.otpChallenge.create({
    data: {
      phoneE164: phone,
      purpose: normalizedPurpose,
      userId: user?.id || null,
      codeHash: hashOtp(phone, normalizedPurpose, code),
      maxAttempts: OTP_MAX_ATTEMPTS,
      expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000)
    }
  });

  return { code, expiresInSeconds: OTP_TTL_MINUTES * 60 };
}

async function verifyOtp({ phoneE164, purpose, code }) {
  const phone = phoneSchema.parse(phoneE164);
  const normalizedPurpose = normalizePurpose(purpose);
  const challenge = await prisma.otpChallenge.findFirst({
    where: { phoneE164: phone, purpose: normalizedPurpose, consumedAt: null },
    orderBy: { createdAt: 'desc' }
  });
  if (!challenge) throw new Error('OTP_NOT_FOUND');
  if (challenge.expiresAt.getTime() < Date.now()) throw new Error('OTP_EXPIRED');
  if (challenge.attempts >= challenge.maxAttempts) throw new Error('OTP_TOO_MANY_ATTEMPTS');

  const expected = Buffer.from(challenge.codeHash, 'hex');
  const actual = Buffer.from(hashOtp(phone, normalizedPurpose, String(code || '')), 'hex');
  const ok = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  if (!ok) {
    await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
    throw new Error('OTP_INVALID');
  }

  await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });
  return true;
}

async function register({ phoneE164, username, password, displayName, device }) {
  const phone = phoneSchema.parse(phoneE164);
  const uname = usernameSchema.parse(username).toLowerCase();
  const pass = passwordSchema.parse(password);

  const existing = await prisma.user.findFirst({ where: { OR: [{ phoneE164: phone }, { username: uname }] }, select: { id: true } });
  if (existing) throw new Error('USER_ALREADY_EXISTS');

  await verifyOtp({ phoneE164: phone, purpose: 'REGISTER', code: device.otpCode });
  const passwordHash = await bcrypt.hash(pass, 12);

  let user;
  try {
    user = await prisma.$transaction(async (tx) => tx.user.create({
      data: {
        phoneE164: phone,
        username: uname,
        passwordHash,
        phoneVerifiedAt: new Date(),
        profile: { create: { displayName: String(displayName || uname).trim().slice(0, 64) || uname } },
        wallet: { create: {} }
      },
      include: { profile: true }
    }));
  } catch (error) {
    if (error?.code === 'P2002') throw new Error('USER_ALREADY_EXISTS');
    throw error;
  }

  return issueSession({ user, device });
}

async function passwordLogin({ login, password, device }) {
  const value = String(login || '').trim();
  const user = await prisma.user.findFirst({
    where: value.startsWith('+') ? { phoneE164: value } : { username: value.toLowerCase() },
    include: { profile: true }
  });
  if (!user || !user.passwordHash || user.status !== 'ACTIVE') throw new Error('INVALID_CREDENTIALS');
  if (!(await bcrypt.compare(String(password || ''), user.passwordHash))) throw new Error('INVALID_CREDENTIALS');
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return issueSession({ user, device });
}

async function issueSession({ user, device }) {
  const deviceKey = String(device?.deviceKey || '').trim();
  if (!deviceKey) throw new Error('DEVICE_KEY_REQUIRED');
  const dbDevice = await prisma.device.upsert({
    where: { userId_deviceKey: { userId: user.id, deviceKey } },
    create: {
      userId: user.id,
      deviceKey,
      platform: String(device?.platform || 'unknown'),
      deviceName: device?.deviceName || null,
      appVersion: device?.appVersion || null,
      userAgent: device?.userAgent || null,
      ipHash: device?.ip ? sha256(device.ip) : null
    },
    update: {
      platform: String(device?.platform || 'unknown'),
      deviceName: device?.deviceName || null,
      appVersion: device?.appVersion || null,
      userAgent: device?.userAgent || null,
      ipHash: device?.ip ? sha256(device.ip) : null,
      lastSeenAt: new Date()
    }
  });
  if (dbDevice.banned) throw new Error('DEVICE_BANNED');

  const refreshToken = randomToken();
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      deviceId: dbDevice.id,
      refreshTokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_DAYS * 86400000)
    }
  });

  return {
    accessToken: signAccessToken(user, session.id),
    refreshToken,
    sessionId: session.id,
    user: sanitizeUser(user)
  };
}

async function refreshSession(refreshToken) {
  const tokenHash = sha256(refreshToken || '');
  const session = await prisma.session.findUnique({
    where: { refreshTokenHash: tokenHash },
    include: { user: { include: { profile: true } }, device: true }
  });
  if (!session || session.status !== 'ACTIVE' || session.expiresAt.getTime() < Date.now()) throw new Error('REFRESH_INVALID');
  if (session.device.banned || session.user.status !== 'ACTIVE') throw new Error('SESSION_BLOCKED');

  const nextRefresh = randomToken();
  const updated = await prisma.session.update({
    where: { id: session.id },
    data: { refreshTokenHash: sha256(nextRefresh), lastUsedAt: new Date() }
  });
  return {
    accessToken: signAccessToken(session.user, updated.id),
    refreshToken: nextRefresh,
    sessionId: updated.id,
    user: sanitizeUser(session.user)
  };
}

async function revokeSession({ sessionId, userId, reason = 'logout' }) {
  await prisma.session.updateMany({
    where: { id: sessionId, userId, status: 'ACTIVE' },
    data: { status: 'REVOKED', revokedAt: new Date(), revokeReason: reason }
  });
}

async function revokeAllSessions(userId, exceptSessionId) {
  await prisma.session.updateMany({
    where: { userId, status: 'ACTIVE', ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
    data: { status: 'REVOKED', revokedAt: new Date(), revokeReason: 'revoke_all' }
  });
}

async function listDevices(userId) {
  return prisma.device.findMany({ where: { userId }, orderBy: { lastSeenAt: 'desc' } });
}

function sanitizeUser(user) {
  return {
    id: user.id,
    phoneE164: user.phoneE164,
    username: user.username,
    role: user.role,
    status: user.status,
    profile: user.profile || null
  };
}

module.exports = {
  requestOtp,
  verifyOtp,
  register,
  passwordLogin,
  refreshSession,
  revokeSession,
  revokeAllSessions,
  listDevices,
  sanitizeUser,
  sha256
};
