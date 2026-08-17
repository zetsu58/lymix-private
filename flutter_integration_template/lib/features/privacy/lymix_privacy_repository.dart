import '../../core/api/lymix_api_client.dart';

class LymixPrivacyRepository {
  final LymixApiClient api;

  const LymixPrivacyRepository(this.api);

  Future<Map<String, dynamic>> exportMyData() async {
    final data = await api.get('/api/v1/me/export');
    return Map<String, dynamic>.from(data as Map);
  }

  Future<void> deleteAccount({required String password}) async {
    await api.delete('/api/v1/me', body: {'password': password});
    await api.clearTokens();
  }
}
