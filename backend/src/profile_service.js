'use strict';

const { z } = require('zod');
const { prisma } = require('./db');

const updateProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(64).optional(),
  avatarUrl: z.string().url().max(2048).nullable().optional(),
  bio: z.string().max(500).nullable().optional(),
  gender: z.string().max(32).nullable().optional(),
  countryCode: z.string().length(2).toUpperCase().nullable().optional(),
  language: z.string().min(2).max(10).optional(),
  birthDate: z.coerce.date().nullable().optional()
}).strict();

async function getProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      phoneE164: true,
      role: true,
      status: true,
      phoneVerifiedAt: true,
      createdAt: true,
      profile: true,
      wallet: { select: { currency: true, balance: true } }
    }
  });
  if (!user) throw new Error('USER_NOT_FOUND');
  return {
    ...user,
    wallet: user.wallet ? { currency: user.wallet.currency, balance: user.wallet.balance.toString() } : { currency: 'COIN', balance: '0' }
  };
}

async function updateProfile(userId, input) {
  const data = updateProfileSchema.parse(input || {});
  return prisma.profile.upsert({
    where: { userId },
    create: { userId, displayName: data.displayName || 'Lymix User', ...data },
    update: data
  });
}

async function getSudUserInfo(userId) {
  const user = await prisma.user.findUnique({
    where: { id: String(userId) },
    select: { id: true, status: true, profile: true }
  });
  if (!user || user.status !== 'ACTIVE') throw new Error('USER_NOT_ACTIVE');
  return {
    uid: user.id,
    nick_name: user.profile?.displayName || `Lymix ${user.id.slice(-6)}`,
    avatar_url: user.profile?.avatarUrl || '',
    gender: user.profile?.gender || '',
    is_ai: 0,
    ai_level: 0
  };
}

module.exports = { getProfile, updateProfile, getSudUserInfo, updateProfileSchema };
