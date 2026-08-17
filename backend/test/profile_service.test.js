'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { prisma } = require('../src/db');
const { getProfile, getPublicProfile, updateProfile } = require('../src/profile_service');

async function createUser(suffix) {
  return prisma.user.create({
    data: {
      phoneE164: `+90554${String(suffix).padStart(7, '0')}`,
      username: `profile_test_${suffix}`,
      phoneVerifiedAt: new Date(),
      profile: { create: { displayName: `Profile Test ${suffix}` } },
      wallet: { create: { balance: 1234n } }
    },
    include: { profile: true }
  });
}

async function cleanup(userId) {
  if (userId) await prisma.user.deleteMany({ where: { id: userId } });
}

test('private profile returns wallet while public profile never exposes phone or wallet', async () => {
  const user = await createUser(Date.now() % 10000000);
  try {
    const mine = await getProfile(user.id);
    assert.equal(mine.phoneE164, user.phoneE164);
    assert.equal(mine.wallet.balance, '1234');

    const visible = await getPublicProfile(user.id);
    assert.equal(visible.id, user.id);
    assert.equal(visible.profile.displayName, user.profile.displayName);
    assert.equal(Object.prototype.hasOwnProperty.call(visible, 'phoneE164'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(visible, 'wallet'), false);
  } finally {
    await cleanup(user.id);
  }
});

test('profile updates persist normalized fields and create an audit record', async () => {
  const user = await createUser((Date.now() + 1) % 10000000);
  try {
    const updated = await updateProfile(user.id, {
      displayName: '  Lymix Test User  ',
      bio: '  Merhaba Lymix  ',
      countryCode: 'tr',
      language: 'TR',
      gender: 'PRIVATE',
      avatarUrl: 'https://example.com/avatar.png'
    });

    assert.equal(updated.displayName, 'Lymix Test User');
    assert.equal(updated.bio, 'Merhaba Lymix');
    assert.equal(updated.countryCode, 'TR');
    assert.equal(updated.language, 'tr');
    assert.equal(updated.gender, 'private');

    const audit = await prisma.auditLog.findFirst({
      where: { userId: user.id, action: 'PROFILE_UPDATED' },
      orderBy: { createdAt: 'desc' }
    });
    assert.ok(audit);
    assert.deepEqual(audit.metadata.fields, ['avatarUrl', 'bio', 'countryCode', 'displayName', 'gender', 'language']);
  } finally {
    await cleanup(user.id);
  }
});

test('profile validation rejects insecure avatar urls and future birth dates', async () => {
  const user = await createUser((Date.now() + 2) % 10000000);
  try {
    await assert.rejects(() => updateProfile(user.id, { avatarUrl: 'http://example.com/a.png' }));
    await assert.rejects(() => updateProfile(user.id, { birthDate: new Date(Date.now() + 86400000).toISOString() }));
  } finally {
    await cleanup(user.id);
  }
});
