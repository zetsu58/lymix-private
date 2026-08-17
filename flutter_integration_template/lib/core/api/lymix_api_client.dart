import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import '../../config/lymix_environment.dart';

class LymixApiException implements Exception {
  final int statusCode;
  final String code;
  final String message;
  final Object? body;

  const LymixApiException({
    required this.statusCode,
    required this.code,
    required this.message,
    this.body,
  });

  @override
  String toString() => 'LymixApiException($statusCode, $code, $message)';
}

class LymixSessionTokens {
  final String accessToken;
  final String refreshToken;
  final String? sessionId;

  const LymixSessionTokens({
    required this.accessToken,
    required this.refreshToken,
    this.sessionId,
  });
}

class LymixApiClient {
  static const _accessKey = 'lymix.access_token';
  static const _refreshKey = 'lymix.refresh_token';
  static const _sessionKey = 'lymix.session_id';

  final http.Client _http;
  final FlutterSecureStorage _storage;
  final String baseUrl;
  Future<bool>? _refreshInFlight;

  LymixApiClient({
    http.Client? httpClient,
    FlutterSecureStorage? storage,
    String? baseUrl,
  })  : _http = httpClient ?? http.Client(),
        _storage = storage ?? const FlutterSecureStorage(),
        baseUrl = baseUrl ?? LymixEnvironment.requireApiBase();

  Uri _uri(String path, [Map<String, dynamic>? query]) {
    final normalized = path.startsWith('/') ? path : '/$path';
    final uri = Uri.parse('$baseUrl$normalized');
    if (query == null || query.isEmpty) return uri;
    return uri.replace(
      queryParameters: {
        for (final entry in query.entries)
          if (entry.value != null) entry.key: entry.value.toString(),
      },
    );
  }

  Future<LymixSessionTokens?> readTokens() async {
    final access = await _storage.read(key: _accessKey);
    final refresh = await _storage.read(key: _refreshKey);
    if (access == null || refresh == null) return null;
    return LymixSessionTokens(
      accessToken: access,
      refreshToken: refresh,
      sessionId: await _storage.read(key: _sessionKey),
    );
  }

  Future<void> saveTokens(Map<String, dynamic> json) async {
    final access = json['accessToken']?.toString();
    final refresh = json['refreshToken']?.toString();
    if (access == null || access.isEmpty || refresh == null || refresh.isEmpty) {
      throw const LymixApiException(
        statusCode: 500,
        code: 'TOKEN_RESPONSE_INVALID',
        message: 'Sunucu oturum bilgisi eksik döndürdü.',
      );
    }
    await _storage.write(key: _accessKey, value: access);
    await _storage.write(key: _refreshKey, value: refresh);
    final sid = json['sessionId']?.toString();
    if (sid != null && sid.isNotEmpty) {
      await _storage.write(key: _sessionKey, value: sid);
    }
  }

  Future<void> clearTokens() async {
    await Future.wait([
      _storage.delete(key: _accessKey),
      _storage.delete(key: _refreshKey),
      _storage.delete(key: _sessionKey),
    ]);
  }

  Future<dynamic> get(
    String path, {
    Map<String, dynamic>? query,
    bool authenticated = true,
  }) {
    return _request('GET', path, query: query, authenticated: authenticated);
  }

  Future<dynamic> post(
    String path, {
    Object? body,
    Map<String, dynamic>? query,
    bool authenticated = true,
  }) {
    return _request('POST', path,
        body: body, query: query, authenticated: authenticated);
  }

  Future<dynamic> patch(
    String path, {
    Object? body,
    bool authenticated = true,
  }) {
    return _request('PATCH', path, body: body, authenticated: authenticated);
  }

  Future<dynamic> delete(
    String path, {
    Object? body,
    bool authenticated = true,
  }) {
    return _request('DELETE', path, body: body, authenticated: authenticated);
  }

  Future<dynamic> _request(
    String method,
    String path, {
    Object? body,
    Map<String, dynamic>? query,
    required bool authenticated,
    bool allowRefresh = true,
  }) async {
    final headers = <String, String>{
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    if (authenticated) {
      final token = await _storage.read(key: _accessKey);
      if (token != null && token.isNotEmpty) {
        headers['Authorization'] = 'Bearer $token';
      }
    }

    final encoded = body == null ? null : jsonEncode(body);
    late http.Response response;
    final uri = _uri(path, query);

    switch (method) {
      case 'GET':
        response = await _http.get(uri, headers: headers);
        break;
      case 'POST':
        response = await _http.post(uri, headers: headers, body: encoded);
        break;
      case 'PATCH':
        response = await _http.patch(uri, headers: headers, body: encoded);
        break;
      case 'DELETE':
        response = await _http.delete(uri, headers: headers, body: encoded);
        break;
      default:
        throw ArgumentError('Unsupported HTTP method: $method');
    }

    if (response.statusCode == 401 && authenticated && allowRefresh) {
      final refreshed = await _refreshOnce();
      if (refreshed) {
        return _request(
          method,
          path,
          body: body,
          query: query,
          authenticated: authenticated,
          allowRefresh: false,
        );
      }
    }

    final decoded = _decode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final map = decoded is Map<String, dynamic> ? decoded : null;
      throw LymixApiException(
        statusCode: response.statusCode,
        code: map?['code']?.toString() ?? 'HTTP_${response.statusCode}',
        message: map?['message']?.toString() ?? 'İstek tamamlanamadı.',
        body: decoded,
      );
    }
    return decoded;
  }

  Future<bool> _refreshOnce() {
    final current = _refreshInFlight;
    if (current != null) return current;
    final future = _refresh();
    _refreshInFlight = future;
    return future.whenComplete(() => _refreshInFlight = null);
  }

  Future<bool> _refresh() async {
    final refreshToken = await _storage.read(key: _refreshKey);
    if (refreshToken == null || refreshToken.isEmpty) return false;

    final response = await _http.post(
      _uri('/api/v1/auth/refresh'),
      headers: const {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({'refreshToken': refreshToken}),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      await clearTokens();
      return false;
    }

    final decoded = _decode(response.body);
    if (decoded is! Map<String, dynamic>) return false;
    final access = decoded['accessToken']?.toString();
    if (access == null || access.isEmpty) return false;
    await _storage.write(key: _accessKey, value: access);
    if (decoded['refreshToken'] != null) {
      await _storage.write(
        key: _refreshKey,
        value: decoded['refreshToken'].toString(),
      );
    }
    if (decoded['sessionId'] != null) {
      await _storage.write(
        key: _sessionKey,
        value: decoded['sessionId'].toString(),
      );
    }
    return true;
  }

  dynamic _decode(String body) {
    if (body.trim().isEmpty) return null;
    try {
      return jsonDecode(body);
    } catch (_) {
      return body;
    }
  }

  void close() => _http.close();
}
