'use strict';

const { prisma } = require('./db');

function asBigIntAmount(value) {
  const amount = BigInt(String(value));
  if (amount <= 0n) throw new Error('LEDGER_AMOUNT_MUST_BE_POSITIVE');
  return amount;
}

async function postLedgerEntry({ userId, idempotencyKey, direction, amount, source, externalRef, metadata }) {
  const value = asBigIntAmount(amount);
  const dir = String(direction || '').toUpperCase();
  if (!['CREDIT', 'DEBIT'].includes(dir)) throw new Error('LEDGER_DIRECTION_INVALID');
  if (!idempotencyKey || String(idempotencyKey).length > 191) throw new Error('LEDGER_IDEMPOTENCY_KEY_INVALID');

  return prisma.$transaction(async (tx) => {
    const existing = await tx.ledgerEntry.findUnique({ where: { idempotencyKey: String(idempotencyKey) } });
    if (existing) return { entry: existing, duplicate: true };

    const wallet = await tx.wallet.upsert({
      where: { userId },
      create: { userId },
      update: {}
    });

    const before = BigInt(wallet.balance);
    const after = dir === 'CREDIT' ? before + value : before - value;
    if (after < 0n) throw new Error('INSUFFICIENT_BALANCE');

    const updated = await tx.wallet.updateMany({
      where: { id: wallet.id, version: wallet.version, balance: wallet.balance },
      data: { balance: after, version: { increment: 1 } }
    });
    if (updated.count !== 1) throw new Error('WALLET_CONCURRENT_UPDATE');

    const entry = await tx.ledgerEntry.create({
      data: {
        userId,
        walletId: wallet.id,
        idempotencyKey: String(idempotencyKey),
        externalRef: externalRef ? String(externalRef) : null,
        direction: dir,
        amount: value,
        balanceBefore: before,
        balanceAfter: after,
        source: String(source || 'SYSTEM'),
        metadata: metadata || undefined
      }
    });

    return { entry, duplicate: false };
  }, { isolationLevel: 'Serializable' });
}

async function reverseLedgerEntry({ entryId, idempotencyKey, actorId, reason }) {
  return prisma.$transaction(async (tx) => {
    const original = await tx.ledgerEntry.findUnique({ where: { id: entryId } });
    if (!original) throw new Error('LEDGER_ENTRY_NOT_FOUND');
    if (original.status !== 'POSTED') throw new Error('LEDGER_ENTRY_NOT_REVERSIBLE');
    if (original.reversal) throw new Error('LEDGER_ENTRY_ALREADY_REVERSED');

    const existing = await tx.ledgerEntry.findUnique({ where: { idempotencyKey } });
    if (existing) return { entry: existing, duplicate: true };

    const wallet = await tx.wallet.findUnique({ where: { id: original.walletId } });
    if (!wallet) throw new Error('WALLET_NOT_FOUND');
    const before = BigInt(wallet.balance);
    const after = original.direction === 'CREDIT' ? before - BigInt(original.amount) : before + BigInt(original.amount);
    if (after < 0n) throw new Error('REVERSAL_WOULD_NEGATIVE_BALANCE');

    const updated = await tx.wallet.updateMany({
      where: { id: wallet.id, version: wallet.version, balance: wallet.balance },
      data: { balance: after, version: { increment: 1 } }
    });
    if (updated.count !== 1) throw new Error('WALLET_CONCURRENT_UPDATE');

    const reversal = await tx.ledgerEntry.create({
      data: {
        userId: original.userId,
        walletId: original.walletId,
        idempotencyKey,
        externalRef: original.externalRef,
        direction: original.direction === 'CREDIT' ? 'DEBIT' : 'CREDIT',
        amount: original.amount,
        balanceBefore: before,
        balanceAfter: after,
        source: `${original.source}:REVERSAL`,
        metadata: { reason: reason || 'reversal', actorId: actorId || null, originalEntryId: original.id },
        reversedEntryId: original.id
      }
    });
    await tx.ledgerEntry.update({ where: { id: original.id }, data: { status: 'REVERSED' } });
    return { entry: reversal, duplicate: false };
  }, { isolationLevel: 'Serializable' });
}

async function getWallet(userId) {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) return { currency: 'COIN', balance: '0', version: 0 };
  return { id: wallet.id, currency: wallet.currency, balance: wallet.balance.toString(), version: wallet.version };
}

async function listLedger(userId, { take = 50, cursor } = {}) {
  const rows = await prisma.ledgerEntry.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(Number(take || 50), 1), 100),
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
  });
  return rows.map((row) => ({ ...row, amount: row.amount.toString(), balanceBefore: row.balanceBefore.toString(), balanceAfter: row.balanceAfter.toString() }));
}

module.exports = { postLedgerEntry, reverseLedgerEntry, getWallet, listLedger };
