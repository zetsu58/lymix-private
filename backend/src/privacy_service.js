'use strict';

const bcrypt = require('bcryptjs');
const { prisma } = require('./db');

async function exportMyData(userId) {
  const id = String(userId);
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      profile: true,
      devices: true,
      sessions: { select: { id: true, status: true, expiresAt: true, lastUsedAt: true, createdAt: true, deviceId: true } },
      wallet: true,
      ledgerEntries: { orderBy: { createdAt: 'desc' }, take: 1000 },
      gameOrders: { orderBy: { createdAt: 'desc' }, take: 1000 },
      roomGameSessions: { orderBy: { joinedAt: 'desc' }, take: 1000 },
      auditLogs: { orderBy: { createdAt: 'desc' }, take: 1000 }
    }
  });
  if (!user) throw new Error('USER_NOT_FOUND');
  const clean = JSON.parse(JSON.stringify(user, (_, value) => typeof value === 'bigint' ? value.toString() : value));
  delete clean.passwordHash;
  if (clean.sessions) clean.sessions = clean.sessions.map(({ refreshTokenHash, ...s }) => s);
  return { exportedAt: new Date().toISOString(), user: clean };
}

async function deleteMyAccount({ userId, password }) {
  const id = String(userId);
  const user = await prisma.user.findUnique({ where: { id }, include: { profile: true } });
  if (!user) throw new Error('USER_NOT_FOUND');
  if (user.role === 'SUPER_ADMIN') throw new Error('SUPER_ADMIN_DELETE_BLOCKED');
  if (!user.passwordHash || !(await bcrypt.compare(String(password || ''), user.passwordHash))) throw new Error('INVALID_CREDENTIALS');

  const suffix = id.replace(/[^a-zA-Z0-9]/g, '').slice(-24);
  await prisma.$transaction(async (tx) => {
    await tx.session.updateMany({
      where: { userId: id, status: 'ACTIVE' },
      data: { status: 'REVOKED', revokedAt: new Date(), revokeReason: 'account_deleted' }
    });
    await tx.otpChallenge.deleteMany({ where: { userId: id } });
    await tx.device.updateMany({
      where: { userId: id },
      data: { pushToken: null, ipHash: null, userAgent: null, deviceName: null, trusted: false, banned: false }
    });
    if (user.profile) {
      await tx.profile.update({
        where: { userId: id },
        data: { displayName: 'Deleted User', avatarUrl: null, bio: null, gender: null, countryCode: null, birthDate: null }
      });
    }
    await tx.user.update({
      where: { id },
      data: {
        phoneE164: `deleted:${suffix}`,
        username: `deleted_${suffix}`,
        passwordHash: null,
        phoneVerifiedAt: null,
        status: 'DELETED'
      }
    });
    await tx.auditLog.create({ data: { userId: id, actorId: id, action: 'ACCOUNT_DELETED', target: id } });
  });
  return { ok: true, deletedAt: new Date().toISOString() };
}

module.exports = { exportMyData, deleteMyAccount };
