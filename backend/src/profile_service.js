'use strict';

const { z } = require('zod');
const { prisma } = require('./db');

const SUPPORTED_LANGUAGES = new Set(['tr', 'en', 'de', 'it', 'ru', 'hi', 'az', 'ar']);
const GENDERS = new Set(['male', 'female', 'other', 'private']);

const httpsUrl = z.string().url().max(2048).refine((value) => {
  try { return new URL(value).protocol === 'https:'; } catch (_) { return false; }
}, 'HTTPS_URL_REQUIRED');

const updateProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(64).refine((v) => !/[\u0000-\u001F\u007F]/.test(v), 'DISPLAY_NAME_INVALID').optional(),
  avatarUrl: httpsUrl.nullable().optional(),
  bio: z.string().trim().max(500).nullable().optional(),
  gender: z.string().trim().toLowerCase().refine((v) => GENDERS.has(v), 'GENDER_INVALID').nullable().optional(),
  countryCode: z.string().trim().length(2).toUpperCase().regex(/^[A-Z]{2}$/).nullable().optional(),
  language: z.string().trim().toLowerCase().refine((v) => SUPPORTED_LANGUAGES.has(v), 'LANGUAGE_UNSUPPORTED').optional(),
  birthDate: z.coerce.date().nullable().optional()
}).strict().superRefine((data, ctx) => {
  if (!data.birthDate) return;
  const now = new Date();
  if (data.birthDate.getTime() > now.getTime()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['birthDate'], message: 'BIRTH_DATE_FUTURE' });
    return;
  }
  const oldest = new Date(Date.UTC(now.getUTCFullYear() - 120, now.getUTCMonth(), now.getUTCDate()));
  if (data.birthDate < oldest) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['birthDate'], message: 'BIRTH_DATE_INVALID' });
});

const PRIVATE_PROFILE_SELECT = {
  id: true,
  username: true,
  phoneE164: true,
  role: true,
  status: true,
  phoneVerifiedAt: true,
  createdAt: true,
  profile: true,
  wallet: { select: { currency: true, balance: true } }
};

const PUBLIC_PROFILE_SELECT = {
  id: true,
  username: true,
  role: true,
  status: true,
  createdAt: true,
  profile: {
    select: {
      displayName: true,
      avatarUrl: true,
      bio: true,
      gender: true,
      countryCode: true,
      language: true,
      vipLevel: true,
      createdAt: true,
      updatedAt: true
    }
  }
};

async function getProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: String(userId) },
    select: PRIVATE_PROFILE_SELECT
  });
  if (!user) throw new Error('USER_NOT_FOUND');
  return {
    ...user,
    wallet: user.wallet ? { currency: user.wallet.currency, balance: user.wallet.balance.toString() } : { currency: 'COIN', balance: '0' }
  };
}

async function getPublicProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: String(userId) },
    select: PUBLIC_PROFILE_SELECT
  });
  if (!user || user.status === 'DELETED') throw new Error('USER_NOT_FOUND');
  return user;
}

async function updateProfile(userId, input) {
  const uid = String(userId);
  const data = updateProfileSchema.parse(input || {});
  const user = await prisma.user.findUnique({ where: { id: uid }, select: { id: true, status: true } });
  if (!user) throw new Error('USER_NOT_FOUND');
  if (user.status !== 'ACTIVE') throw new Error('USER_NOT_ACTIVE');

  const cleaned = { ...data };
  if (Object.prototype.hasOwnProperty.call(cleaned, 'bio') && cleaned.bio === '') cleaned.bio = null;

  return prisma.$transaction(async (tx) => {
    const profile = await tx.profile.upsert({
      where: { userId: uid },
      create: { userId: uid, displayName: cleaned.displayName || 'Lymix User', ...cleaned },
      update: cleaned
    });
    await tx.auditLog.create({
      data: {
        userId: uid,
        actorId: uid,
        action: 'PROFILE_UPDATED',
        target: uid,
        metadata: { fields: Object.keys(cleaned).sort() }
      }
    });
    return profile;
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

module.exports = {
  getProfile,
  getPublicProfile,
  updateProfile,
  getSudUserInfo,
  updateProfileSchema,
  SUPPORTED_LANGUAGES
};
