import '../../core/api/lymix_api_client.dart';

class LymixDevicePayload {
  final String deviceKey;
  final String platform;
  final String? deviceName;
  final String appVersion;

  const LymixDevicePayload({
    required this.deviceKey,
    required this.platform,
    required this.appVersion,
    this.deviceName,
  });

  Map<String, dynamic> toJson() => {
        'deviceKey': deviceKey,
        'platform': platform,
        'deviceName': deviceName,
        'appVersion': appVersion,
      };
}

class LymixAuthRepository {
  final LymixApiClient api;

  const LymixAuthRepository(this.api);

  Future<Map<String, dynamic>> runtimeConfig() async {
    final data = await api.get('/api/v1/runtime/config', authenticated: false);
    return Map<String, dynamic>.from(data as Map);
  }

  Future<void> requestOtp({
    required String phoneE164,
    required String purpose,
  }) async {
    await api.post(
      '/api/v1/auth/otp/request',
      authenticated: false,
      body: {'phoneE164': phoneE164, 'purpose': purpose},
    );
  }

  Future<Map<String, dynamic>> register({
    required String phoneE164,
    required String username,
    required String password,
    required String displayName,
    required String otpCode,
    required LymixDevicePayload device,
  }) async {
    final data = await api.post(
      '/api/v1/auth/register',
      authenticated: false,
      body: {
        'phoneE164': phoneE164,
        'username': username,
        'password': password,
        'displayName': displayName,
        'otpCode': otpCode,
        ...device.toJson(),
      },
    );
    final map = Map<String, dynamic>.from(data as Map);
    await api.saveTokens(map);
    return map;
  }

  Future<Map<String, dynamic>> loginWithPassword({
    required String login,
    required String password,
    required LymixDevicePayload device,
  }) async {
    final data = await api.post(
      '/api/v1/auth/login',
      authenticated: false,
      body: {'login': login, 'password': password, ...device.toJson()},
    );
    final map = Map<String, dynamic>.from(data as Map);
    await api.saveTokens(map);
    return map;
  }

  Future<Map<String, dynamic>> loginWithOtp({
    required String phoneE164,
    required String otpCode,
    required LymixDevicePayload device,
  }) async {
    final data = await api.post(
      '/api/v1/auth/login/otp',
      authenticated: false,
      body: {'phoneE164': phoneE164, 'otpCode': otpCode, ...device.toJson()},
    );
    final map = Map<String, dynamic>.from(data as Map);
    await api.saveTokens(map);
    return map;
  }

  Future<Map<String, dynamic>> me() async {
    final data = await api.get('/api/v1/me');
    return Map<String, dynamic>.from(data as Map);
  }

  Future<Map<String, dynamic>> updateProfile(Map<String, dynamic> patch) async {
    final data = await api.patch('/api/v1/me', body: patch);
    return Map<String, dynamic>.from(data as Map);
  }

  Future<List<dynamic>> sessions() async {
    final data = await api.get('/api/v1/sessions');
    return List<dynamic>.from(data as List);
  }

  Future<List<dynamic>> devices() async {
    final data = await api.get('/api/v1/devices');
    return List<dynamic>.from(data as List);
  }

  Future<void> revokeSession(String sessionId) async {
    await api.delete('/api/v1/sessions/$sessionId');
  }

  Future<void> setDeviceTrusted(String deviceId, bool trusted) async {
    await api.patch(
      '/api/v1/devices/$deviceId/trusted',
      body: {'trusted': trusted},
    );
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    await api.post(
      '/api/v1/auth/password/change',
      body: {'currentPassword': currentPassword, 'newPassword': newPassword},
    );
  }

  Future<void> resetPassword({
    required String phoneE164,
    required String otpCode,
    required String newPassword,
  }) async {
    await api.post(
      '/api/v1/auth/password/reset',
      authenticated: false,
      body: {
        'phoneE164': phoneE164,
        'otpCode': otpCode,
        'newPassword': newPassword,
      },
    );
  }

  Future<void> logout() async {
    try {
      await api.post('/api/v1/auth/logout');
    } finally {
      await api.clearTokens();
    }
  }

  Future<void> logoutAll({bool keepCurrent = false}) async {
    await api.post('/api/v1/auth/logout-all', body: {'keepCurrent': keepCurrent});
    if (!keepCurrent) await api.clearTokens();
  }
}
