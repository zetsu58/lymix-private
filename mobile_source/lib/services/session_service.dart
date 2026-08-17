import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SessionUser {
  final String id;
  final String login;
  final String displayName;
  final String role;
  final int level;
  final List<String> badges;
  final String? phoneE164;

  const SessionUser({required this.id, required this.login, required this.displayName, required this.role, required this.level, required this.badges, this.phoneE164});

  factory SessionUser.fromJson(Map<String, dynamic> json) {
    final profile = json['profile'] is Map ? Map<String, dynamic>.from(json['profile'] as Map) : const <String, dynamic>{};
    return SessionUser(
      id: '${json['id'] ?? ''}',
      login: '${json['username'] ?? json['login'] ?? ''}',
      displayName: '${profile['displayName'] ?? json['displayName'] ?? json['name'] ?? ''}',
      role: '${json['role'] ?? 'USER'}',
      level: (profile['level'] as num?)?.toInt() ?? (json['level'] as num?)?.toInt() ?? 1,
      badges: (profile['badges'] as List? ?? json['badges'] as List? ?? const []).map((e) => '$e').toList(),
      phoneE164: json['phoneE164']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {'id':id,'login':login,'displayName':displayName,'role':role,'level':level,'badges':badges,'phoneE164':phoneE164};
}

class SessionService {
  static const _storage = FlutterSecureStorage(aOptions: AndroidOptions(encryptedSharedPreferences: true));
  static const _tokenKey='lymix.auth.accessToken', _refreshKey='lymix.auth.refreshToken', _userKey='lymix.auth.user', _sessionKey='lymix.auth.sessionId';

  static Future<void> save({required String accessToken, required String refreshToken, required SessionUser user, String? sessionId}) async => Future.wait([
    _storage.write(key:_tokenKey,value:accessToken), _storage.write(key:_refreshKey,value:refreshToken), _storage.write(key:_userKey,value:jsonEncode(user.toJson())),
    if(sessionId!=null) _storage.write(key:_sessionKey,value:sessionId),
  ]);
  static Future<void> updateTokens({required String accessToken, required String refreshToken, String? sessionId, SessionUser? user}) async => Future.wait([
    _storage.write(key:_tokenKey,value:accessToken), _storage.write(key:_refreshKey,value:refreshToken),
    if(sessionId!=null) _storage.write(key:_sessionKey,value:sessionId), if(user!=null) _storage.write(key:_userKey,value:jsonEncode(user.toJson())),
  ]);
  static Future<String?> token()=>_storage.read(key:_tokenKey);
  static Future<String?> refreshToken()=>_storage.read(key:_refreshKey);
  static Future<String?> sessionId()=>_storage.read(key:_sessionKey);
  static Future<SessionUser?> user() async { final raw=await _storage.read(key:_userKey); if(raw==null||raw.isEmpty)return null; try{return SessionUser.fromJson(Map<String,dynamic>.from(jsonDecode(raw) as Map));}catch(_){return null;} }
  static Future<bool> hasSession() async => (await refreshToken())?.isNotEmpty ?? false;
  static Future<void> clear()=>Future.wait([_storage.delete(key:_tokenKey),_storage.delete(key:_refreshKey),_storage.delete(key:_userKey),_storage.delete(key:_sessionKey)]);
}
