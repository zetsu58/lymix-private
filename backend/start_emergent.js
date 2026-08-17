'use strict';

// Emergent staging launcher only.
// Emergent ingress can route web/admin traffic and /api traffic to different
// container ports. The same Express application is therefore exposed on both
// ports without changing the normal production startup path.

const http = require('http');
const express = require('express');

const ADMIN_PORT = Number(process.env.PORT || 3000);
const API_PORT = Number(process.env.API_PORT || 8001);

if (!Number.isInteger(ADMIN_PORT) || ADMIN_PORT <= 0) {
  throw new Error('PORT must be a valid TCP port');
}
if (!Number.isInteger(API_PORT) || API_PORT <= 0) {
  throw new Error('API_PORT must be a valid TCP port');
}
if (ADMIN_PORT === API_PORT) {
  throw new Error('PORT and API_PORT must be different for Emergent dual-port mode');
}

const originalListen = express.application.listen;
let started = false;

express.application.listen = function lymixEmergentDualListen(...args) {
  if (started) {
    throw new Error('Lymix Emergent dual-port listener was started more than once');
  }
  started = true;

  const callback = typeof args[args.length - 1] === 'function'
    ? args[args.length - 1]
    : null;
  const app = this;

  const adminServer = http.createServer(app);
  const apiServer = http.createServer(app);
  let readyCount = 0;

  const onReady = (label) => () => {
    readyCount += 1;
    console.log(`LYMIX listening on ${label}`);
    if (readyCount === 2 && callback) callback();
  };

  const shutdown = () => {
    adminServer.close();
    apiServer.close();
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);

  adminServer.listen(ADMIN_PORT, '0.0.0.0', onReady(`admin/web :${ADMIN_PORT}`));
  apiServer.listen(API_PORT, '0.0.0.0', onReady(`api :${API_PORT}`));

  // Preserve Express' conventional return type for callers that keep a
  // reference to app.listen(). The second server is managed in this module.
  return adminServer;
};

require('./admin_bootstrap');
