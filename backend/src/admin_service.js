'use strict';

const { prisma } = require('./db');

async function getMetrics() {
  const now = new Date();
  const last15m = new Date(now.getTime() - 15 * 60_000);
  const [users, activeUsers, bannedUsers, activeSessions, activeGameSessions, ledgerPosted] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { lastLoginAt: { gte: last15m }, status: 'ACTIVE' } }),
    prisma.user.count({ where: { status: 'BANNED' } }),
    prisma.session.count({ where: { status: 'ACTIVE', expiresAt: { gt: now } } }),
    prisma.roomGameSession.count({ where: { leftAt: null } }),
    prisma.ledgerEntry.count({ where: { status: 'POSTED' } })
  ]);
  return { users, activeUsers, bannedUsers, activeSessions, activeGameSessions, ledgerPosted, at: now.toISOString() };
}

async function listUsers({ take = 50, cursor, q, status, role } = {}) {
  const where = {};
  if (status) where.status = String(status).toUpperCase();
  if (role) where.role = String(role).toUpperCase();
  if (q) {
    const query = String(q).trim();
    where.OR = [
      { username: { contains: query, mode: 'insensitive' } },
      { phoneE164: { contains: query } },
      { profile: { is: { displayName: { contains: query, mode: 'insensitive' } } } }
    ];
  }
  return prisma.user.findMany({
    where,
    select: {
      id: true, phoneE164: true, username: true, role: true, status: true, phoneVerifiedAt: true,
      lastLoginAt: true, createdAt: true, profile: true,
      wallet: { select: { balance: true, currency: true } },
      _count: { select: { devices: true, sessions: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(Number(take || 50), 1), 100),
    ...(cursor ? { cursor: { id: String(cursor) }, skip: 1 } : {})
  });
}

async function setUserStatus({ actorId, userId, status, reason }) {
  const normalized = String(status || '').toUpperCase();
  if (!['ACTIVE', 'SUSPENDED', 'BANNED'].includes(normalized)) throw new Error('USER_STATUS_INVALID');
  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({ where: { id: userId }, data: { status: normalized } });
    if (normalized !== 'ACTIVE') {
      await tx.session.updateMany({
        where: { userId, status: 'ACTIVE' },
        data: { status: 'REVOKED', revokedAt: new Date(), revokeReason: `user_${normalized.toLowerCase()}` }
      });
    }
    await tx.auditLog.create({ data: { userId, actorId, action: `USER_STATUS_${normalized}`, target: userId, metadata: { reason: reason || null } } });
    return updated;
  });
  return user;
}

async function setUserRole({ actorId, userId, role }) {
  const normalized = String(role || '').toUpperCase();
  if (!['USER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN'].includes(normalized)) throw new Error('USER_ROLE_INVALID');
  const updated = await prisma.user.update({ where: { id: userId }, data: { role: normalized } });
  await prisma.auditLog.create({ data: { userId, actorId, action: `USER_ROLE_${normalized}`, target: userId } });
  return updated;
}

async function setDeviceBan({ actorId, deviceId, banned, reason }) {
  return prisma.$transaction(async (tx) => {
    const device = await tx.device.update({ where: { id: deviceId }, data: { banned: Boolean(banned) } });
    if (banned) {
      await tx.session.updateMany({
        where: { deviceId, status: 'ACTIVE' },
        data: { status: 'REVOKED', revokedAt: new Date(), revokeReason: 'device_banned' }
      });
    }
    await tx.auditLog.create({
      data: { userId: device.userId, actorId, action: banned ? 'DEVICE_BANNED' : 'DEVICE_UNBANNED', target: deviceId, metadata: { reason: reason || null } }
    });
    return device;
  });
}

async function listAudit({ take = 100, cursor, action } = {}) {
  return prisma.auditLog.findMany({
    where: action ? { action: String(action) } : undefined,
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(Number(take || 100), 1), 200),
    ...(cursor ? { cursor: { id: String(cursor) }, skip: 1 } : {})
  });
}

module.exports = { getMetrics, listUsers, setUserStatus, setUserRole, setDeviceBan, listAudit };
