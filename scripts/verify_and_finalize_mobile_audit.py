from pathlib import Path
import re, shutil, sys

root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('.')
repo_root = Path(__file__).resolve().parents[1]

# ---------------------------------------------------------------------------
# 1) Overlay the already-reviewed production auth files onto the real ZIP source.
# ---------------------------------------------------------------------------
overlays = {
    repo_root / 'mobile_source/lib/services/auth_service.dart': root / 'lib/services/auth_service.dart',
    repo_root / 'mobile_source/lib/services/session_service.dart': root / 'lib/services/session_service.dart',
    repo_root / 'mobile_source/lib/screens/register_screen.dart': root / 'lib/screens/register_screen.dart',
}
for src, dst in overlays.items():
    if not src.is_file():
        raise SystemExit(f'MISSING_PRODUCTION_OVERLAY: {src}')
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    print(f'OVERLAY {src.relative_to(repo_root)} -> {dst.relative_to(root)}')

# Restore avatar support on top of the production SessionService overlay.
session_file = root / 'lib/services/session_service.dart'
session = session_file.read_text()
start = session.find('class SessionUser {')
end = session.find('class SessionService {', start)
if start < 0 or end < 0:
    raise SystemExit('SESSION_USER_CLASS_NOT_FOUND')
user_class = '''class SessionUser {
  final String id;
  final String login;
  final String displayName;
  final String role;
  final int level;
  final List<String> badges;
  final String? phoneE164;
  final String? avatarUrl;

  const SessionUser({
    required this.id,
    required this.login,
    required this.displayName,
    required this.role,
    required this.level,
    required this.badges,
    this.phoneE164,
    this.avatarUrl,
  });

  factory SessionUser.fromJson(Map<String, dynamic> json) {
    final profile = json['profile'] is Map
        ? Map<String, dynamic>.from(json['profile'] as Map)
        : const <String, dynamic>{};
    final rawBadges = profile['badges'] is List
        ? profile['badges'] as List
        : (json['badges'] is List ? json['badges'] as List : const []);
    return SessionUser(
      id: '${json['id'] ?? ''}',
      login: '${json['username'] ?? json['login'] ?? ''}',
      displayName: '${profile['displayName'] ?? json['displayName'] ?? json['name'] ?? ''}',
      role: '${json['role'] ?? 'USER'}',
      level: (profile['level'] as num?)?.toInt() ?? (json['level'] as num?)?.toInt() ?? 1,
      badges: rawBadges.map((e) => '$e').toList(),
      phoneE164: json['phoneE164']?.toString(),
      avatarUrl: (profile['avatarUrl'] ?? profile['avatar'] ?? json['avatarUrl'] ?? json['avatar'])?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'login': login,
    'displayName': displayName,
    'role': role,
    'level': level,
    'badges': badges,
    'phoneE164': phoneE164,
    'avatarUrl': avatarUrl,
  };
}

'''
session_file.write_text(session[:start] + user_class + session[end:])

# ---------------------------------------------------------------------------
# 2) Finalize the room seat visual patch (remove compact invalid ternaries).
# ---------------------------------------------------------------------------
visual = root / 'lib/widgets/lymix_visual_production.dart'
text = visual.read_text()
text = text.replace('accent.withValues(alpha:animate?.95:.38)', 'accent.withValues(alpha: animate ? .95 : .38)')
text = text.replace('accent.withValues(alpha:animate?.22:.08)', 'accent.withValues(alpha: animate ? .22 : .08)')
visual.write_text(text)

# ---------------------------------------------------------------------------
# 3) Wire the Game Center catalog to the authenticated SUD backend.
# ---------------------------------------------------------------------------
game_provider = root / 'lib/services/game_provider_service.dart'
game_provider.write_text(r'''import '../core/api_client.dart';
import 'game_provider_adapter.dart';
import 'session_service.dart';

class GameCatalogEntry {
  final String id;
  final String name;
  final String category;
  final String? iconUrl;
  final String provider;

  const GameCatalogEntry({
    required this.id,
    required this.name,
    required this.category,
    required this.provider,
    this.iconUrl,
  });

  factory GameCatalogEntry.fromJson(Map<String, dynamic> json) => GameCatalogEntry(
        id: '${json['mgId'] ?? json['mg_id'] ?? json['id'] ?? json['gameId'] ?? ''}',
        name: '${json['name'] ?? json['gameName'] ?? json['game_name'] ?? json['mgName'] ?? json['mg_name'] ?? 'Oyun'}',
        category: '${json['category'] ?? json['gameType'] ?? json['game_type'] ?? 'SUD'}',
        iconUrl: (json['iconUrl'] ?? json['icon_url'] ?? json['gamePic'] ?? json['game_pic'])?.toString(),
        provider: '${json['provider'] ?? 'sud'}',
      );
}

class GameProviderService implements GameProviderAdapter {
  final ApiClient _api = const ApiClient(tokenProvider: SessionService.token);

  List<dynamic>? _findList(dynamic value) {
    if (value is List) return value;
    if (value is! Map) return null;
    for (final key in const ['games','gameList','game_list','mgList','mg_list','list']) {
      final found = value[key];
      if (found is List) return found;
    }
    final data = value['data'];
    if (data != null && !identical(data, value)) return _findList(data);
    return null;
  }

  Future<List<GameCatalogEntry>> getCatalog() async {
    final decoded = await _api.getJson('/api/games/sud/catalog?platform=2');
    final raw = _findList(decoded);
    if (raw == null) return const [];
    return raw
        .whereType<Map>()
        .map((e) => GameCatalogEntry.fromJson(Map<String, dynamic>.from(e)))
        .where((e) => e.id.isNotEmpty)
        .toList(growable: false);
  }

  @override
  Future<GameLaunchSession> launch(GameLaunchRequest request) async {
    throw const ApiException(
      'SUD oyunları native SudGIP ekranından açılır. GameCenterScreen doğrudan SudGameScreen kullanmalıdır.',
      code: 'SUD_NATIVE_REQUIRED',
    );
  }
}
''')

# Official SUD Flutter plugin used by SudTechnology/hello-sud-plus-flutter.
pubspec = root / 'pubspec.yaml'
pub = pubspec.read_text()
if 'sud_gip_plugin:' not in pub:
    anchor = '  agora_rtc_engine: 6.5.4\n'
    if anchor not in pub:
        raise SystemExit('PUBSPEC_AGORA_ANCHOR_NOT_FOUND')
    pub = pub.replace(anchor, anchor + '  sud_gip_plugin: 0.0.3\n')
pubspec.write_text(pub)

# Native SUD host. appId/appKey/code come from our backend; appSecret never enters Flutter.
sud_screen = root / 'lib/screens/sud_game_screen.dart'
sud_screen.write_text(r'''import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:sud_gip_plugin/sud_gip_plugin.dart';
import '../core/api_client.dart';
import '../services/session_service.dart';

class SudGameScreen extends StatefulWidget {
  final String roomId;
  final String mgId;
  final String gameName;
  const SudGameScreen({super.key, required this.roomId, required this.mgId, required this.gameName});

  @override
  State<SudGameScreen> createState() => _SudGameScreenState();
}

class _SudGameScreenState extends State<SudGameScreen> with WidgetsBindingObserver {
  final GlobalKey _viewKey = GlobalKey();
  final ApiClient _api = const ApiClient(tokenProvider: SessionService.token);
  int? _viewId;
  Widget? _gameView;
  late final SudGIPFSMGameDelegate _delegate;
  String? _error;
  bool _starting = true;
  bool _joinedRecorded = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _delegate = SudGIPFSMGameDelegate(
      onGameLoadingProgress: (stage, retCode, progress) {},
      onGameStarted: () { if (mounted) setState(() => _starting = false); },
      onGameDestroyed: () {},
      onExpireCode: (_) => _renewCode(),
      onGameStateChange: (state, dataJson) {},
      onPlayerStateChange: (userId, state, dataJson) {},
    );
    _gameView = getSudGIPPlatformView((int viewId) {
      _viewId = viewId;
      WidgetsBinding.instance.addPostFrameCallback((_) => _start());
    });
  }

  Future<Map<String, dynamic>> _credentials() async {
    final data = await _api.postJson('/api/games/sud/get-code', {'roomId': widget.roomId, 'mgId': widget.mgId});
    if (data is! Map) throw const ApiException('SUD code yanıtı geçersiz.', code: 'SUD_CODE_INVALID');
    return Map<String, dynamic>.from(data);
  }

  Future<void> _start() async {
    try {
      final user = await SessionService.user();
      final viewId = _viewId;
      if (user == null || user.id.isEmpty || viewId == null) {
        throw const ApiException('Oyun için aktif kullanıcı oturumu gerekli.', code: 'AUTH_REQUIRED');
      }
      final auth = await _credentials();
      final appId = '${auth['appId'] ?? ''}';
      final appKey = '${auth['appKey'] ?? ''}';
      final code = '${auth['code'] ?? ''}';
      if (appId.isEmpty || appKey.isEmpty || code.isEmpty) {
        throw const ApiException('SUD erişim bilgileri henüz hazır değil.', code: 'SUD_NOT_CONFIGURED');
      }

      final init = await SudGipPlugin.initSDK(appId, appKey, user.id);
      if ((init['retCode'] as num?)?.toInt() != 0) {
        throw ApiException('SUD SDK başlatılamadı: ${init['retMsg'] ?? init['retCode']}', code: 'SUD_INIT_FAILED');
      }
      SudGipPlugin.setFSMGame(viewId, _delegate);

      final renderBox = _viewKey.currentContext?.findRenderObject() as RenderBox?;
      final logical = renderBox?.size ?? MediaQuery.sizeOf(context);
      final dpr = MediaQuery.devicePixelRatioOf(context);
      final width = (logical.width * dpr).ceil().clamp(1, 10000);
      final height = (logical.height * dpr).ceil().clamp(1, 10000);
      final viewInfo = jsonEncode({
        'ret_code': 0,
        'ret_msg': 'success',
        'view_size': {'width': width, 'height': height},
        'view_game_rect': {'left': 0, 'top': 0, 'right': 0, 'bottom': 0},
      });
      final config = jsonEncode({
        'gameMode': 1,
        'gameCPU': 0,
        'gameSoundControl': 0,
        'gameSoundVolume': 100,
        'viewScale': 1.0,
        'autoScale': 0,
        'ui': {},
      });
      final locale = Localizations.localeOf(context).toLanguageTag();
      final loaded = await SudGipPlugin.loadGame(viewId, user.id, widget.roomId, code, widget.mgId, locale, viewInfo, config);
      if ((loaded['retCode'] as num?)?.toInt() != 0) {
        throw ApiException('SUD oyunu yüklenemedi: ${loaded['retMsg'] ?? loaded['retCode']}', code: 'SUD_LOAD_FAILED');
      }
      try {
        await _api.postJson('/api/v1/games/sud/session/join', {'roomId': widget.roomId, 'mgId': widget.mgId});
        _joinedRecorded = true;
      } catch (_) {}
    } on ApiException catch (e) {
      if (mounted) setState(() { _error = e.message; _starting = false; });
    } catch (e) {
      if (mounted) setState(() { _error = 'Oyun başlatılamadı: $e'; _starting = false; });
    }
  }

  Future<void> _renewCode() async {
    try {
      final viewId = _viewId;
      if (viewId == null) return;
      final auth = await _credentials();
      final code = '${auth['code'] ?? ''}';
      if (code.isNotEmpty) await SudGipPlugin.updateCode(viewId, code);
    } catch (_) {}
  }

  Future<void> _destroy() async {
    final viewId = _viewId;
    if (viewId != null) {
      try { SudGipPlugin.removeFSMGame(viewId); } catch (_) {}
      try { await SudGipPlugin.destroyGame(viewId); } catch (_) {}
      try { await SudGipPlugin.dispose(viewId); } catch (_) {}
    }
    if (_joinedRecorded) {
      try { await _api.postJson('/api/v1/games/sud/session/leave', {'roomId': widget.roomId, 'mgId': widget.mgId}); } catch (_) {}
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final id = _viewId;
    if (id == null) return;
    if (state == AppLifecycleState.resumed) SudGipPlugin.playGame(id);
    if (state == AppLifecycleState.paused) SudGipPlugin.pauseGame(id);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _destroy();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(widget.gameName)),
    body: Stack(children: [
      Positioned.fill(child: Container(key: _viewKey, color: const Color(0xFF08070D), child: _gameView)),
      if (_starting) const Center(child: CircularProgressIndicator()),
      if (_error != null)
        Center(child: Container(
          margin: const EdgeInsets.all(24), padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(color: const Color(0xEE15111D), borderRadius: BorderRadius.circular(20)),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.sports_esports_rounded, size: 42),
            const SizedBox(height: 12),
            Text(_error!, textAlign: TextAlign.center),
            const SizedBox(height: 14),
            FilledButton(onPressed: () { setState(() { _error = null; _starting = true; }); _start(); }, child: const Text('Tekrar Dene')),
          ]),
        )),
    ]),
  );
}
''')

# Make Game Center open the native SUD host instead of the obsolete H5 launch URL.
game_center = root / 'lib/screens/game_center_screen.dart'
gc = game_center.read_text()
if "import 'sud_game_screen.dart';" not in gc:
    gc = gc.replace("import '../services/session_service.dart';\n", "import '../services/session_service.dart';\nimport 'sud_game_screen.dart';\n")
start = gc.find('  Future<void> _open(GameCatalogEntry game) async {')
if start < 0:
    raise SystemExit('GAME_CENTER_OPEN_METHOD_NOT_FOUND')
# _open is the final method before the class closing brace in current source.
end = gc.rfind('\n}')
new_open = '''  Future<void> _open(GameCatalogEntry game) async {
    final user = await SessionService.user();
    if (!mounted) return;
    if (user == null || user.id.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Oyun için aktif oturum gerekli.')));
      return;
    }
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => SudGameScreen(roomId: widget.roomId, mgId: game.id, gameName: game.name),
      ),
    );
  }
'''
gc = gc[:start] + new_open + gc[end:]
game_center.write_text(gc)

# ---------------------------------------------------------------------------
# 4) Production blockers / invariants.
# ---------------------------------------------------------------------------
required = [
    'lib/screens/home_screen.dart',
    'lib/screens/room_screen.dart',
    'lib/screens/room_settings_screen.dart',
    'lib/screens/game_center_screen.dart',
    'lib/screens/sud_game_screen.dart',
    'lib/screens/user_profile_screen.dart',
    'lib/services/session_service.dart',
    'lib/services/auth_service.dart',
]
for rel in required:
    if not (root / rel).is_file():
        raise SystemExit(f'MISSING_REQUIRED_FILE: {rel}')

room = (root / 'lib/screens/room_screen.dart').read_text()
if 'onTap: () => _seatTap(i)' not in room:
    raise SystemExit('ROOM_SINGLE_TAP_NOT_WIRED')
if 'onLongPress:' not in room:
    raise SystemExit('ROOM_LONG_PRESS_ADMIN_NOT_WIRED')
if 'avatarUrl:current?.avatarUrl' not in room.replace(' ', ''):
    raise SystemExit('ROOM_CURRENT_AVATAR_NOT_WIRED')

visual_text = visual.read_text()
pedestal_start = visual_text.find('class LymixSeatPedestal')
pedestal_end = visual_text.find('class LymixProfileHero', pedestal_start)
pedestal = visual_text[pedestal_start:pedestal_end]
if "Icon(Icons.diamond_rounded" in pedestal or 'widget.contribution' in pedestal:
    raise SystemExit('SEAT_CONTRIBUTION_STRIP_STILL_PRESENT')
if 'animate?.95' in pedestal or 'animate?.22' in pedestal:
    raise SystemExit('INVALID_DART_TERNARY_STILL_PRESENT')

dead = []
callback_re = re.compile(r'on(?:Tap|Pressed|LongPress)\s*:\s*\(\)\s*\{\s*\}')
for p in (root / 'lib').rglob('*.dart'):
    data = p.read_text(errors='ignore')
    for m in callback_re.finditer(data):
        line = data.count('\n', 0, m.start()) + 1
        dead.append(f'{p.relative_to(root)}:{line}')
if dead:
    raise SystemExit('DEAD_UI_CALLBACKS: ' + ', '.join(dead))

auth = (root / 'lib/services/auth_service.dart').read_text()
legacy = [x for x in ['/api/auth/login', '/api/auth/register', '/api/auth/refresh'] if x in auth]
if legacy:
    raise SystemExit('LEGACY_AUTH_ROUTES_STILL_ACTIVE: ' + ', '.join(legacy))
if '/api/v1/auth/login' not in auth or '/api/v1/auth/register' not in auth:
    raise SystemExit('PRODUCTION_AUTH_ROUTES_MISSING')

provider = game_provider.read_text()
if '/api/games/sud/catalog' not in provider:
    raise SystemExit('SUD_CATALOG_ROUTE_NOT_WIRED')
if 'SudGameScreen' not in game_center.read_text():
    raise SystemExit('SUD_NATIVE_GAME_SCREEN_NOT_WIRED')

print('MOBILE_AUDIT_FINAL_VERIFICATION_OK')
