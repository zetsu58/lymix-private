'use strict';

const express = require('express');
const { createProductionCoreRouter } = require('./src/production_core_router');

// The legacy/SUD server currently owns app construction and listen(). Intercept
// listen once so the production core routes are mounted on the same Express app
// before the HTTP server starts, without duplicating or rewriting the SUD gateway.
const originalListen = express.application.listen;
let mounted = false;
express.application.listen = function lymixProductionListen(...args) {
  if (!mounted) {
    this.use('/api/v1', createProductionCoreRouter());
    mounted = true;
  }
  return originalListen.apply(this, args);
};

require('./server');
