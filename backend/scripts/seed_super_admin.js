'use strict';

const bcrypt = require('bcryptjs');
const { prisma } = require('../src/db');

async function main() {
  const phoneE164 = String(process.env.LYMIX_ADMIN_PHONE_E164 || '').trim();
  const username = String(process.env.LYMIX_ADMIN_LOGIN || '').trim().toLowerCase();
  const password = String(process.env.LYMIX_ADMIN_PASSWORD || '');
  const displayName = String(process.env.LYMIX_ADMIN_DISPLAY_NAME || 'Lymix Emre').trim();

  if (!/^\+[1-9]\d{7,14}$/.test(phoneE164)) throw new Error('LYMIX_ADMIN_PHONE_E164 must be valid E.164');
  if (!/^[a-zA-Z0-9_.]{3,32}$/.test(username)) throw new Error('LYMIX_ADMIN_LOGIN must be 3-32 safe characters');
  if (password.length < 12) throw new Error('LYMIX_ADMIN_PASSWORD must be at least 12 characters');

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { phoneE164 },
    create: {
      phoneE164,
      username,
      passwordHash,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      phoneVerifiedAt: new Date(),
      profile: { create: { displayName, vipLevel: 10 } },
      wallet: { create: {} }
    },
    update: {
      username,
      passwordHash,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      phoneVerifiedAt: new Date(),
      profile: { upsert: { create: { displayName, vipLevel: 10 }, update: { displayName, vipLevel: 10 } } },
      wallet: { upsert: { create: {}, update: {} } }
    },
    select: { id: true, phoneE164: true, username: true, role: true }
  });

  console.log(`SUPER_ADMIN ready: ${user.id} (${user.username})`);
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => prisma.$disconnect());
