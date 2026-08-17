import '../../core/api/lymix_api_client.dart';

class LymixAgoraToken {
  final String appId;
  final String token;
  final String channelName;
  final String userAccount;
  final int expiresInSeconds;

  const LymixAgoraToken({
    required this.appId,
    required this.token,
    required this.channelName,
    required this.userAccount,
    required this.expiresInSeconds,
  });

  factory LymixAgoraToken.fromJson(Map<String, dynamic> json) {
    return LymixAgoraToken(
      appId: json['appId'].toString(),
      token: json['token'].toString(),
      channelName: json['channelName'].toString(),
      userAccount: json['userAccount'].toString(),
      expiresInSeconds: int.tryParse(json['expiresInSeconds'].toString()) ?? 3600,
    );
  }
}

class LymixAgoraRepository {
  final LymixApiClient api;

  const LymixAgoraRepository(this.api);

  Future<bool> isConfigured() async {
    final data = await api.get('/api/v1/agora/status');
    final map = Map<String, dynamic>.from(data as Map);
    return map['configured'] == true;
  }

  Future<LymixAgoraToken> tokenForRoom(String roomId) async {
    final data = await api.post(
      '/api/v1/agora/rtc-token',
      body: {'roomId': roomId},
    );
    return LymixAgoraToken.fromJson(Map<String, dynamic>.from(data as Map));
  }
}
