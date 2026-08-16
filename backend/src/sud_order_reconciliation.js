'use strict';

const crypto = require('crypto');
const { prisma } = require('./db');
const { SudServerApi } = require('../sud_server_api');

const sudApi = new SudServerApi({
  appId: process.env.SUD_APP_ID,
  appSecret: process.env.SUD_APP_SECRET,
  configCacheMs: Number(process.env.SUD_API_CONFIG_CACHE_MS || 24 * 60 * 60 * 1000)
});

const VALID_STATUSES = new Set(['CREATED', 'EXECUTING', 'EXECUTE_SUCCESS', 'EXECUTE_FAIL']);

function enabled() {
  return String(process.env.SUD_ENABLE_ORDER_API || 'false').toLowerCase() === 'true' &&
    String(process.env.SUD_LEDGER_READY || 'false').toLowerCase() === 'true';
}

function newOutOrderId() {
  return `lymix_${crypto.randomUUID().replace(/-/g, '')}`;
}

function normalizeStatus(value) {
  const status = String(value || 'CREATED').toUpperCase();
  return VALID_STATUSES.has(status) ? status : 'CREATED';
}

async function createTrackedOrder({ actorId, outOrderId, outGroupId, mgId, roomId, cmd, fromUid, toUid, value, payload }) {
  if (!enabled()) throw new Error('SUD_ORDER_API_DISABLED');
  const merchantId = String(outOrderId || newOutOrderId());
  if (!merchantId || merchantId.length > 64) throw new Error('SUD_OUT_ORDER_ID_INVALID');
  if (!mgId || !roomId || !cmd || !fromUid || !toUid) throw new Error('SUD_ORDER_FIELDS_REQUIRED');
  if (!Number.isInteger(Number(value)) || Number(value) < -2147483648 || Number(value) > 2147483647) throw new Error('SUD_ORDER_VALUE_INVALID');

  const existing = await prisma.gameOrder.findUnique({ where: { outOrderId: merchantId } });
  if (existing) return { order: existing, duplicate: true, sud: null };

  await prisma.gameOrder.create({
    data: {
      userId: String(fromUid),
      outOrderId: merchantId,
      mgId: String(mgId),
      roomId: String(roomId),
      command: String(cmd),
      value: Number(value),
      status: 'CREATED',
      requestPayload: { outGroupId: outGroupId || null, toUid: String(toUid), payload: payload || null, actorId: actorId || null }
    }
  });

  try {
    const result = await sudApi.createOrder({
      outOrderId: merchantId,
      outGroupId,
      mgId,
      roomId,
      cmd,
      fromUid,
      toUid,
      value: Number(value),
      payload
    });
    const data = result?.data || {};
    const updated = await prisma.gameOrder.update({
      where: { outOrderId: merchantId },
      data: {
        sudOrderId: data.order_id ? String(data.order_id) : null,
        status: 'CREATED',
        responsePayload: result,
        lastError: null
      }
    });
    await prisma.auditLog.create({ data: { userId: String(fromUid), actorId: actorId || null, action: 'SUD_ORDER_CREATED', target: merchantId, metadata: { sudOrderId: data.order_id || null } } });
    return { order: updated, duplicate: false, sud: result };
  } catch (error) {
    await prisma.gameOrder.update({ where: { outOrderId: merchantId }, data: { lastError: String(error?.message || error) } });
    await prisma.auditLog.create({ data: { userId: String(fromUid), actorId: actorId || null, action: 'SUD_ORDER_CREATE_UNCERTAIN', target: merchantId, metadata: { error: String(error?.message || error), retCode: error?.retCode ?? null } } });
    error.outOrderId = merchantId;
    throw error;
  }
}

async function reconcileOrder(order) {
  const result = await sudApi.queryOrder(order.sudOrderId ? { orderId: order.sudOrderId } : { outOrderId: order.outOrderId });
  const data = result?.data || {};
  const status = normalizeStatus(data.status);
  const updated = await prisma.gameOrder.update({
    where: { id: order.id },
    data: {
      sudOrderId: data.order_id ? String(data.order_id) : order.sudOrderId,
      status,
      responsePayload: result,
      lastError: null
    }
  });
  if (status !== order.status) {
    await prisma.auditLog.create({ data: { userId: order.userId, actorId: 'SYSTEM', action: `SUD_ORDER_${status}`, target: order.outOrderId, metadata: { sudOrderId: data.order_id || order.sudOrderId || null } } });
  }
  return updated;
}

async function reconcileById(id) {
  const order = await prisma.gameOrder.findFirst({ where: { OR: [{ id: String(id) }, { outOrderId: String(id) }, { sudOrderId: String(id) }] } });
  if (!order) throw new Error('SUD_ORDER_NOT_FOUND');
  return reconcileOrder(order);
}

async function reconcilePending({ limit = 20 } = {}) {
  if (!enabled()) return { enabled: false, checked: 0, updated: 0, errors: [] };
  const rows = await prisma.gameOrder.findMany({
    where: { status: { in: ['CREATED', 'EXECUTING'] } },
    orderBy: { updatedAt: 'asc' },
    take: Math.min(Math.max(Number(limit || 20), 1), 100)
  });
  let updated = 0;
  const errors = [];
  for (const row of rows) {
    try {
      await reconcileOrder(row);
      updated += 1;
    } catch (error) {
      errors.push({ outOrderId: row.outOrderId, error: String(error?.message || error), retCode: error?.retCode ?? null });
      await prisma.gameOrder.update({ where: { id: row.id }, data: { lastError: String(error?.message || error) } });
    }
  }
  return { enabled: true, checked: rows.length, updated, errors };
}

async function listOrders({ status, take = 50, cursor } = {}) {
  return prisma.gameOrder.findMany({
    where: status ? { status: String(status).toUpperCase() } : undefined,
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(Number(take || 50), 1), 100),
    ...(cursor ? { cursor: { id: String(cursor) }, skip: 1 } : {})
  });
}

function startOrderReconciler() {
  const intervalMs = Math.max(30_000, Number(process.env.SUD_ORDER_RECONCILE_INTERVAL_MS || 60_000));
  if (!enabled()) return null;
  const timer = setInterval(() => {
    reconcilePending().catch((error) => console.error('SUD order reconciliation failed:', error));
  }, intervalMs);
  timer.unref?.();
  return timer;
}

module.exports = { enabled, createTrackedOrder, reconcileById, reconcilePending, listOrders, startOrderReconciler };
