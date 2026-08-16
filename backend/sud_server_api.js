const crypto = require('crypto');

class SudServerApi {
  constructor({ appId, appSecret, configCacheMs = 24 * 60 * 60 * 1000 }) {
    this.appId = String(appId || '');
    this.appSecret = String(appSecret || '');
    this.configCacheMs = Number(configCacheMs || 0) || 24 * 60 * 60 * 1000;
    this.cachedConfig = null;
    this.cachedAt = 0;
  }

  get configured() {
    return Boolean(this.appId && this.appSecret);
  }

  createServiceSignature() {
    return crypto.createHmac('md5', this.appSecret).update(this.appId).digest('hex');
  }

  createAuthorization(bodyText) {
    const timestamp = String(Date.now());
    const nonce = crypto.randomBytes(12).toString('hex');
    const signContent = `${this.appId}\n${timestamp}\n${nonce}\n${bodyText}\n`;
    const signature = crypto.createHmac('sha1', this.appSecret).update(signContent).digest('hex');
    return `Sud-Auth app_id="${this.appId}",timestamp="${timestamp}",nonce="${nonce}",signature="${signature}"`;
  }

  async getConfig({ force = false } = {}) {
    if (!this.configured) throw new Error('SUD appId/appSecret not configured');
    const fresh = this.cachedConfig && (Date.now() - this.cachedAt) < this.configCacheMs;
    if (!force && fresh) return this.cachedConfig;

    const signature = this.createServiceSignature();
    const url = `https://asc.sudden.ltd/${signature}`;
    const response = await fetch(url, { headers: { Accept: 'application/json', 'Content-Type': 'application/json' } });
    if (!response.ok) throw new Error(`SUD config discovery failed: HTTP ${response.status}`);
    const data = await response.json();
    if (!data || typeof data !== 'object') throw new Error('SUD config discovery returned invalid JSON');
    this.cachedConfig = data;
    this.cachedAt = Date.now();
    return data;
  }

  resolveEndpoint(config, key) {
    const groups = [config?.api || {}, config?.match_api || {}, config?.cross_app_api || {}, config?.bullet_api || {}, config || {}];
    const aliases = {
      mg_list: ['mg_list', 'get_mg_list'],
      mg_info: ['mg_info', 'get_mg_info'],
      query_game_report_info: ['query_game_report_info', 'get_game_report_info'],
      get_game_report_info_page: ['get_game_report_info_page'],
      get_player_results: ['get_player_results'],
      report_game_round_bill: ['report_game_round_bill'],
      push_event: ['push_event'],
      create_order: ['create_order'],
      batch_create_order: ['batch_create_order'],
      query_order: ['query_order'],
      query_match_base: ['query_match_base'],
      query_match_round_ids: ['query_match_round_ids'],
      query_user_settle: ['query_user_settle'],
      auth_app_list: ['auth_app_list'],
      auth_room_list: ['auth_room_list'],
      create_match: ['create_match'],
      cancel_match: ['cancel_match'],
      query_game_config: ['query_game_config'],
      query_user_matching: ['query_user_matching'],
      bullet_init: ['init'],
      bullet_command: ['command'],
      bullet_refresh: ['refresh']
    };
    for (const name of aliases[key] || [key]) {
      for (const group of groups) {
        const value = group?.[name];
        if (typeof value === 'string' && value.startsWith('https://')) return value;
      }
    }
    throw new Error(`SUD endpoint not available: ${key}`);
  }

  async post(key, body, { retryConfig = true } = {}) {
    const config = await this.getConfig();
    const url = this.resolveEndpoint(config, key);
    const payload = { ...body };
    if (payload.app_id === undefined) payload.app_id = this.appId;
    const bodyText = JSON.stringify(payload);
    const authorization = this.createAuthorization(bodyText);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json;charset=utf-8',
        Accept: 'application/json'
      },
      body: bodyText
    });

    if (!response.ok) {
      if (retryConfig) {
        try { await this.getConfig({ force: true }); } catch (_) {}
        return this.post(key, body, { retryConfig: false });
      }
      throw new Error(`SUD ${key} failed: HTTP ${response.status}`);
    }

    const result = await response.json();
    if (Number(result?.ret_code || 0) !== 0) {
      const error = new Error(result?.ret_msg || `SUD ${key} returned ret_code=${result?.ret_code}`);
      error.retCode = result?.ret_code;
      error.sudResponse = result;
      throw error;
    }
    return result;
  }

  getGameList({ platform = 2, unityEngineVersion } = {}) {
    const body = { platform: Number(platform || 2) };
    if (unityEngineVersion) body.unity_engine_version = String(unityEngineVersion);
    return this.post('mg_list', body);
  }

  getGameInfo(mgId, { platform = 2, unityEngineVersion } = {}) {
    const body = { mg_id: String(mgId), platform: Number(platform || 2) };
    if (unityEngineVersion) body.unity_engine_version = String(unityEngineVersion);
    return this.post('mg_info', body);
  }

  queryGameReport({ gameRoundId, reportGameInfoKey, filterTypes } = {}) {
    if (!gameRoundId && !reportGameInfoKey) throw new Error('gameRoundId or reportGameInfoKey is required');
    const body = {};
    if (gameRoundId) body.game_round_id = String(gameRoundId);
    if (reportGameInfoKey) body.report_game_info_key = String(reportGameInfoKey);
    if (Array.isArray(filterTypes) && filterTypes.length) body.filter_types = filterTypes.map(String);
    return this.post('query_game_report_info', body);
  }

  getRoomReports({ roomId, pageNo = 0, pageSize = 5 } = {}) {
    if (!roomId) throw new Error('roomId is required');
    const size = Math.min(Math.max(Number(pageSize || 5), 1), 10);
    return this.post('get_game_report_info_page', {
      app_id: this.appId,
      app_secret: this.appSecret,
      room_id: String(roomId),
      page_no: Math.max(Number(pageNo || 0), 0),
      page_size: size
    });
  }

  getPlayerResults({ gameRoundId, pageNo = 0, pageSize = 10 } = {}) {
    if (!gameRoundId) throw new Error('gameRoundId is required');
    const size = Math.min(Math.max(Number(pageSize || 10), 1), 100);
    return this.post('get_player_results', {
      game_round_id: String(gameRoundId),
      page_no: Math.max(Number(pageNo || 0), 0),
      page_size: size
    });
  }

  pushEvent({ event, mgId, data }) {
    if (!event || !mgId || !data || typeof data !== 'object') throw new Error('event, mgId and data are required');
    return this.post('push_event', {
      event: String(event),
      mg_id: String(mgId),
      timestamp: String(Date.now()),
      data
    });
  }

  createOrder({ outOrderId, outGroupId, mgId, roomId, cmd, fromUid, toUid, value, payload } = {}) {
    if (!outOrderId || String(outOrderId).length > 64) throw new Error('outOrderId is required and must be <=64 chars');
    if (outGroupId && String(outGroupId).length > 64) throw new Error('outGroupId must be <=64 chars');
    if (!mgId || !roomId || !cmd || !fromUid || !toUid) throw new Error('mgId, roomId, cmd, fromUid and toUid are required');
    const n = Number(value);
    if (!Number.isInteger(n) || n < -2147483648 || n > 2147483647) throw new Error('value must be int32');
    const body = {
      out_order_id: String(outOrderId),
      mg_id: String(mgId),
      room_id: String(roomId),
      cmd: String(cmd),
      from_uid: String(fromUid),
      to_uid: String(toUid),
      value: n
    };
    if (outGroupId) body.out_group_id = String(outGroupId);
    if (payload !== undefined) body.payload = payload;
    return this.post('create_order', body);
  }

  // SUD's endpoint is discoverable even when a particular product account has not
  // been entitled yet. Keep the raw batch payload behind a privileged server route
  // until the product-specific batch schema is confirmed for the Lymix entitlement.
  batchCreateOrders(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('batch order body must be an object');
    return this.post('batch_create_order', body);
  }

  queryOrder({ outOrderId, orderId } = {}) {
    if (!outOrderId && !orderId) throw new Error('outOrderId or orderId is required');
    const body = {};
    if (outOrderId) body.out_order_id = String(outOrderId);
    if (orderId) body.order_id = String(orderId);
    return this.post('query_order', body);
  }

  reportGameRoundBill({ mgId, roomId, roundId, currencyAmount, timestamp = Date.now() } = {}) {
    if (!mgId || !roomId || !roundId) throw new Error('mgId, roomId and roundId are required');
    if (currencyAmount === undefined || currencyAmount === null || currencyAmount === '') throw new Error('currencyAmount is required');
    return this.post('report_game_round_bill', {
      mg_id: String(mgId),
      room_id: String(roomId),
      round_id: String(roundId),
      currency_amount: String(currencyAmount),
      timestamp: Number(timestamp)
    });
  }

  queryMatchBase({ matchId, reportGameInfoKey } = {}) {
    if (!matchId && !reportGameInfoKey) throw new Error('matchId or reportGameInfoKey is required');
    const body = {};
    if (matchId) body.match_id = String(matchId);
    if (reportGameInfoKey) body.report_game_info_key = String(reportGameInfoKey);
    return this.post('query_match_base', body);
  }

  queryMatchRoundIds({ matchId, reportGameInfoKey } = {}) {
    if (!matchId && !reportGameInfoKey) throw new Error('matchId or reportGameInfoKey is required');
    const body = {};
    if (matchId) body.match_id = String(matchId);
    if (reportGameInfoKey) body.report_game_info_key = String(reportGameInfoKey);
    return this.post('query_match_round_ids', body);
  }

  // Product-specific response shape varies by Entry-with-Score entitlement; the
  // server still signs and validates the official SUD endpoint response centrally.
  queryUserSettle(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('queryUserSettle body must be an object');
    return this.post('query_user_settle', body);
  }

  queryAuthorizedApps(body = {}) { return this.post('auth_app_list', body); }
  queryAuthorizedRooms(body = {}) { return this.post('auth_room_list', body); }
  createMatch(body) { return this.post('create_match', body || {}); }
  cancelMatch(body) { return this.post('cancel_match', body || {}); }
  queryGameConfig(body) { return this.post('query_game_config', body || {}); }
  queryUserMatching(body) { return this.post('query_user_matching', body || {}); }
  bulletInit(body) { return this.post('bullet_init', body || {}); }
  bulletCommand(body) { return this.post('bullet_command', body || {}); }
  bulletRefresh(body) { return this.post('bullet_refresh', body || {}); }
}

function createSudCallbackVerifier({ appId, appSecret, maxSkewMs = 5 * 60 * 1000 }) {
  const seenNonces = new Map();
  return function verifySudCallback(req, res, next) {
    if (!appId || !appSecret) return res.status(503).json({ ret_code: 1, ret_msg: 'SUD not configured', data: {} });
    const headerAppId = String(req.get('Sud-AppId') || '');
    const timestamp = String(req.get('Sud-Timestamp') || '');
    const nonce = String(req.get('Sud-Nonce') || '');
    const signature = String(req.get('Sud-Signature') || '');
    if (!headerAppId || !timestamp || !nonce || !signature || headerAppId !== String(appId)) {
      return res.status(401).json({ ret_code: 1, ret_msg: 'Invalid SUD signature headers', data: {} });
    }

    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > maxSkewMs) {
      return res.status(401).json({ ret_code: 1, ret_msg: 'Expired SUD callback timestamp', data: {} });
    }

    const now = Date.now();
    for (const [key, expiresAt] of seenNonces) if (expiresAt <= now) seenNonces.delete(key);
    const replayKey = `${timestamp}:${nonce}`;
    if (seenNonces.has(replayKey)) return res.status(409).json({ ret_code: 1, ret_msg: 'Duplicate SUD callback', data: {} });

    const rawBody = typeof req.rawBody === 'string' ? req.rawBody : JSON.stringify(req.body || {});
    const signContent = `${headerAppId}\n${timestamp}\n${nonce}\n${rawBody}\n`;
    const expected = crypto.createHmac('sha1', appSecret).update(signContent).digest('hex');
    const a = Buffer.from(signature, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
    if (!ok) return res.status(401).json({ ret_code: 1, ret_msg: 'Invalid SUD callback signature', data: {} });

    seenNonces.set(replayKey, now + maxSkewMs);
    next();
  };
}

module.exports = { SudServerApi, createSudCallbackVerifier };
