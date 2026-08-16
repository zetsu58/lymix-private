'use strict';

const path = require('path');
const express = require('express');
const { createPrivacyRouter } = require('./src/privacy_router');

// Wrap the existing production bootstrap without rewriting it. When server.js
// finally calls app.listen(), this layer mounts privacy endpoints and the
// static admin console on the same origin, then delegates to the listener.
const originalListen = express.application.listen;
let mounted = false;
express.application.listen = function lymixAdminListen(...args) {
  if (!mounted) {
    this.use('/api/v1', createPrivacyRouter());
    const adminRoot = path.resolve(__dirname, '..', 'admin-web');
    this.use('/admin', express.static(adminRoot, {
      index: 'index.html',
      fallthrough: false,
      maxAge: process.env.NODE_ENV === 'production' ? '5m' : 0,
      setHeaders(res) {
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        res.setHeader('Cache-Control', 'no-store');
      }
    }));
    mounted = true;
  }
  return originalListen.apply(this, args);
};

require('./bootstrap');
