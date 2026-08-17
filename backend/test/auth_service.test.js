'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { prisma } = require('../src/db');
const {
  requestOtp,
  verifyOtp,
  passwordLogin,
  refreshSession
} = require('../src/auth_service');

async function createUser(suffix) {
  const phoneE164 = `+90555${String(suffix).padStart(7, '0')}`;
  const username = `auth_test_${suffix}`;
  const password = 'StrongPass!123';
  const passwordHash = await bcrypt.hash(password, 4);
  const user = await prisma.user.create({
    data: {
      phoneE164,
      username,
      passwordHash,
      phoneVerifiedAt: new Date(),
      profile: { create: { displayName: `Auth Test ${suffix}` } },
      wallet: { create: {} }
    },
    include: { profile: true }
  });
  return { user, phoneE164, username, password };
}

async function cleanupUser(userId) {
  if (!userId) return;
  await prisma.user.deleteMany({ where: { id: userId } });
}

test('rotating refresh token accepts newest token and revokes session on replay', async () => {
  const fixture = await createUser(Date.now() % 10000000);
  try {
    const login = await passwordLogin({
      login: fixture.username,
      password: fixture.password,
      device: {
        deviceKey: `device_${fixture.user.id}`,
        platform: 'test',
        deviceName: 'node-test',
        appVersion: 'test'
      }
    });

    assert.ok(login.accessToken);
    assert.ok(login.refreshToken);

    const rotated = await refreshSession(login.refreshToken);
    assert.ok(rotated.refreshToken);
    assert.notEqual(rotated.refreshToken, login.refreshToken);

    await assert.rejects(
      () => refreshSession(login.refreshToken),
      (error) => error?.message === 'REFRESH_REPLAY_DETECTED'
    );

    const session = await prisma.session.findUnique({ where: { id: login.sessionId } });
    assert.equal(session.status, 'REVOKED');
    assert.equal(session.revokeReason, 'refresh_replay_detected');

    await assert.rejects(
      () => refreshSession(rotated.refreshToken),
      (error) => error?.message === 'REFRESH_INVALID'
    );
  } finally {
    await cleanupUser(fixture.user.id);
  }
});

test('OTP is single-use and invalid attempts are persisted', async () => {
  const suffix = (Date.now() + 1) % 10000000;
  const phoneE164 = `+90554${String(suffix).padStart(7, '0')}`;
  const requested = await requestOtp({ phoneE164, purpose: 'REGISTER' });

  await assert.rejects(
    () => verifyOtp({ phoneE164, purpose: 'REGISTER', code: '000000' }),
    (error) => error?.message === 'OTP_INVALID'
  );

  const afterFailure = await prisma.otpChallenge.findFirst({
    where: { phoneE164, purpose: 'REGISTER' },
    orderBy: { createdAt: 'desc' }
  });
  assert.equal(afterFailure.attempts, 1);

  await verifyOtp({ phoneE164, purpose: 'REGISTER', code: requested.code });
  const consumed = await prisma.otpChallenge.findUnique({ where: { id: afterFailure.id } });
  assert.ok(consumed.consumedAt);

  await assert.rejects(
    () => verifyOtp({ phoneE164, purpose: 'REGISTER', code: requested.code }),
    (error) => error?.message === 'OTP_NOT_FOUND'
  );

  await prisma.otpChallenge.deleteMany({ where: { phoneE164 } });
});

test.after(async () => {
  await prisma.$disconnect();
});
