import '../../core/api/lymix_api_client.dart';

class LymixWalletRepository {
  final LymixApiClient api;

  const LymixWalletRepository(this.api);

  Future<Map<String, dynamic>> wallet() async {
    final data = await api.get('/api/v1/wallet');
    return Map<String, dynamic>.from(data as Map);
  }

  Future<dynamic> ledger({int take = 30, String? cursor}) {
    return api.get(
      '/api/v1/wallet/ledger',
      query: {'take': take, if (cursor != null) 'cursor': cursor},
    );
  }
}
