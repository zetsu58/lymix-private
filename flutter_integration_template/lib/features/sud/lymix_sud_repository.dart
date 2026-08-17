import '../../core/api/lymix_api_client.dart';

class LymixSudRepository {
  final LymixApiClient api;

  const LymixSudRepository(this.api);

  Future<Map<String, dynamic>> status() async {
    final data = await api.get('/api/games/sud/status', authenticated: false);
    return Map<String, dynamic>.from(data as Map);
  }

  Future<dynamic> catalog({int platform = 2}) {
    return api.get(
      '/api/games/sud/catalog',
      query: {'platform': platform},
    );
  }

  Future<Map<String, dynamic>> gameInfo(String mgId, {int platform = 2}) async {
    final data = await api.get(
      '/api/games/sud/game/$mgId',
      query: {'platform': platform},
    );
    return Map<String, dynamic>.from(data as Map);
  }

  Future<Map<String, dynamic>> getCode({
    required String roomId,
    required String mgId,
  }) async {
    final data = await api.post(
      '/api/games/sud/get-code',
      body: {'roomId': roomId, 'mgId': mgId},
    );
    return Map<String, dynamic>.from(data as Map);
  }

  Future<Map<String, dynamic>> joinSession({
    required String roomId,
    required String mgId,
    String? gameRoundId,
    Map<String, dynamic>? metadata,
  }) async {
    final data = await api.post(
      '/api/v1/games/sud/session/join',
      body: {
        'roomId': roomId,
        'mgId': mgId,
        if (gameRoundId != null) 'gameRoundId': gameRoundId,
        if (metadata != null) 'metadata': metadata,
      },
    );
    return Map<String, dynamic>.from(data as Map);
  }

  Future<void> leaveSession({
    required String roomId,
    required String mgId,
  }) async {
    await api.post(
      '/api/v1/games/sud/session/leave',
      body: {'roomId': roomId, 'mgId': mgId},
    );
  }

  Future<dynamic> pushEvent({
    required String mgId,
    required String event,
    required Map<String, dynamic> data,
  }) {
    return api.post(
      '/api/games/sud/events',
      body: {'mgId': mgId, 'event': event, 'data': data},
    );
  }

  Future<dynamic> roomReports(
    String roomId, {
    int pageNo = 1,
    int pageSize = 20,
  }) {
    return api.get(
      '/api/games/sud/reports/room/$roomId',
      query: {'pageNo': pageNo, 'pageSize': pageSize},
    );
  }

  Future<dynamic> playerResults(
    String gameRoundId, {
    int pageNo = 1,
    int pageSize = 20,
  }) {
    return api.get(
      '/api/games/sud/results/$gameRoundId',
      query: {'pageNo': pageNo, 'pageSize': pageSize},
    );
  }
}
