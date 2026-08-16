'use strict';

const { prisma } = require('./db');
const { postLedgerEntry, getWallet } = require('./ledger_service');

function ledgerEnabled() {
  return String(process.env.SUD_LEDGER_READY || 'false').toLowerCase() === 'true';
}

async function getSudAccount(uid) {
  if (!ledgerEnabled()) throw new Error('SUD_LEDGER_NOT_READY');
  const wallet = await getWallet(String(uid));
  return { uid: String(uid), score: Number(wallet.balance), balance: wallet.balance };
}

async function applySudScoreUpdate(payload) {
  if (!ledgerEnabled()) throw new Error('SUD_LEDGER_NOT_READY');
  const orderId = String(payload?.order_id || payload?.orderId || '');
  const uid = String(payload?.uid || payload?.user_id || '');
  if (!orderId) throw new Error('SUD_ORDER_ID_REQUIRED');
  if (!uid) throw new Error('SUD_UID_REQUIRED');

  const rawValue = payload?.value ?? payload?.score ?? payload?.delta;
  const delta = BigInt(String(rawValue));
  if (delta === 0n) return { duplicate: false, noOp: true, wallet: await getWallet(uid) };

  const result = await postLedgerEntry({
    userId: uid,
    idempotencyKey: `sud:update_score:${orderId}`,
    direction: delta > 0n ? 'CREDIT' : 'DEBIT',
    amount: delta > 0n ? delta : -delta,
    source: 'SUD_UPDATE_SCORE',
    externalRef: orderId,
    metadata: payload
  });

  await prisma.auditLog.create({
    data: {
      userId: uid,
      actorId: 'SUD',
      action: result.duplicate ? 'SUD_SCORE_DUPLICATE' : 'SUD_SCORE_APPLIED',
      target: orderId,
      metadata: { direction: delta > 0n ? 'CREDIT' : 'DEBIT', amount: delta.toString() }
    }
  });

  return { ...result, wallet: await getWallet(uid) };
}

async function upsertGameOrder({ userId, outOrderId, sudOrderId, mgId, roomId, command, value, status, requestPayload, responsePayload, lastError }) {
  if (!outOrderId || String(outOrderId).length > 64) throw new Error('SUD_OUT_ORDER_ID_INVALID');
  return prisma.gameOrder.upsert({
    where: { outOrderId: String(outOrderId) },
    create: {
      userId: String(userId),
      outOrderId: String(outOrderId),
      sudOrderId: sudOrderId ? String(sudOrderId) : null,
      mgId: String(mgId),
      roomId: String(roomId),
      command: String(command),
      value: Number(value || 0),
      status: status || 'CREATED',
      requestPayload: requestPayload || undefined,
      responsePayload: responsePayload || undefined,
      lastError: lastError || null
    },
    update: {
      sudOrderId: sudOrderId ? String(sudOrderId) : undefined,
      status: status || undefined,
      responsePayload: responsePayload || undefined,
      lastError: lastError || null
    }
  });
}

async function recordRoomGameSession({ userId, roomId, mgId, gameRoundId, metadata }) {
  return prisma.roomGameSession.create({
    data: { userId: String(userId), roomId: String(roomId), mgId: String(mgId), gameRoundId: gameRoundId ? String(gameRoundId) : null, metadata: metadata || undefined }
  });
}

async function closeRoomGameSession({ userId, roomId, mgId }) {
  const active = await prisma.roomGameSession.findFirst({
    where: { userId: String(userId), roomId: String(roomId), mgId: String(mgId), leftAt: null },
    orderBy: { joinedAt: 'desc' }
  });
  if (!active) return null;
  return prisma.roomGameSession.update({ where: { id: active.id }, data: { leftAt: new Date() } });
}

module.exports = { ledgerEnabled, getSudAccount, applySudScoreUpdate, upsertGameOrder, recordRoomGameSession, closeRoomGameSession };
