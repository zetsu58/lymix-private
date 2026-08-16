'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');
const { createTrackedOrder, reconcileById, reconcilePending, listOrders } = require('./sud_order_reconciliation');

function admin(req, res, next) {
  try {
    const raw = String(req.headers.authorization || '');
    const token = raw.startsWith('Bearer ') ? raw.slice(7) : '';
    const claims = jwt.verify(token, String(process.env.JWT_SECRET || ''), { issuer: 'lymix', audience: 'lymix-app' });
    if (claims.role !== 'SUPER_ADMIN') return res.status(403).json({ code: 'SUPER_ADMIN_REQUIRED' });
    req.auth = claims;
    next();
  } catch (_) {
    res.status(401).json({ code: 'UNAUTHORIZED' });
  }
}

function fail(res, error) {
  const code = String(error?.message || 'SUD_ORDER_FAILED');
  const status = {
    SUD_ORDER_API_DISABLED: 503,
    SUD_OUT_ORDER_ID_INVALID: 400,
    SUD_ORDER_FIELDS_REQUIRED: 400,
    SUD_ORDER_VALUE_INVALID: 400,
    SUD_ORDER_NOT_FOUND: 404
  }[code] || 502;
  return res.status(status).json({ code, message: status >= 500 ? 'SUD order işlemi tamamlanamadı.' : code, outOrderId: error?.outOrderId || null, sudRetCode: error?.retCode ?? null });
}

function createSudOrderRouter() {
  const router = express.Router();

  router.get('/admin/sud/orders', admin, async (req, res) => {
    try { return res.json(await listOrders({ status: req.query.status, take: req.query.take, cursor: req.query.cursor })); }
    catch (error) { return fail(res, error); }
  });

  router.post('/admin/sud/orders', admin, async (req, res) => {
    try {
      return res.status(201).json(await createTrackedOrder({
        actorId: req.auth.sub,
        outOrderId: req.body?.outOrderId,
        outGroupId: req.body?.outGroupId,
        mgId: req.body?.mgId,
        roomId: req.body?.roomId,
        cmd: req.body?.cmd,
        fromUid: req.body?.fromUid,
        toUid: req.body?.toUid,
        value: req.body?.value,
        payload: req.body?.payload
      }));
    } catch (error) { return fail(res, error); }
  });

  router.post('/admin/sud/orders/:id/reconcile', admin, async (req, res) => {
    try { return res.json(await reconcileById(req.params.id)); }
    catch (error) { return fail(res, error); }
  });

  router.post('/admin/sud/orders/reconcile-pending', admin, async (req, res) => {
    try { return res.json(await reconcilePending({ limit: req.body?.limit })); }
    catch (error) { return fail(res, error); }
  });

  return router;
}

module.exports = { createSudOrderRouter };
