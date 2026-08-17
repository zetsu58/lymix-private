import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:sud_gip_plugin/sud_gip_plugin.dart';

import 'lymix_sud_repository.dart';

class LymixSudGameHost extends StatefulWidget {
  final String roomId;
  final String mgId;
  final LymixSudRepository repository;
  final VoidCallback? onStarted;
  final VoidCallback? onDestroyed;

  const LymixSudGameHost({
    super.key,
    required this.roomId,
    required this.mgId,
    required this.repository,
    this.onStarted,
    this.onDestroyed,
  });

  @override
  State<LymixSudGameHost> createState() => _LymixSudGameHostState();
}

class _LymixSudGameHostState extends State<LymixSudGameHost>
    with WidgetsBindingObserver {
  final GlobalKey _viewKey = GlobalKey();
  Widget? _platformView;
  int? _viewId;
  bool _loading = true;
  String? _error;
  late final SudGIPFSMGameDelegate _delegate;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _delegate = SudGIPFSMGameDelegate(
      onGameLoadingProgress: (_, retCode, progress) {
        if (retCode != 0 && mounted) {
          setState(() => _error = 'SUD yükleme hatası: $retCode');
        }
        debugPrint('SUD progress=$progress retCode=$retCode');
      },
      onGameStarted: () {
        if (mounted) setState(() => _loading = false);
        widget.onStarted?.call();
      },
      onGameDestroyed: () => widget.onDestroyed?.call(),
      onExpireCode: (_) => _renewCode(),
      onGameStateChange: (state, dataJson) {
        debugPrint('SUD game state=$state data=$dataJson');
      },
      onPlayerStateChange: (userId, state, dataJson) {
        debugPrint('SUD player=$userId state=$state data=$dataJson');
      },
    );

    _platformView = getSudGIPPlatformView((viewId) {
      _viewId = viewId;
      WidgetsBinding.instance.addPostFrameCallback((_) => _loadGame());
    });
  }

  Future<void> _loadGame() async {
    final viewId = _viewId;
    if (viewId == null || !mounted) return;
    try {
      final session = await widget.repository.getCode(
        roomId: widget.roomId,
        mgId: widget.mgId,
      );
      final appId = session['appId']?.toString() ?? '';
      final appKey = session['appKey']?.toString() ?? '';
      final code = session['code']?.toString() ?? '';
      final userId = session['userId']?.toString() ?? '';
      if (appId.isEmpty || appKey.isEmpty || code.isEmpty || userId.isEmpty) {
        throw StateError('SUD session response eksik.');
      }

      final init = await SudGipPlugin.initSDK(appId, appKey, userId);
      if (init['retCode'] != 0) {
        throw StateError('SUD initSDK retCode=${init['retCode']}');
      }

      SudGipPlugin.setFSMGame(viewId, _delegate);
      await widget.repository.joinSession(
        roomId: widget.roomId,
        mgId: widget.mgId,
      );

      final locale = Localizations.localeOf(context).toLanguageTag();
      final load = await SudGipPlugin.loadGame(
        viewId,
        userId,
        widget.roomId,
        code,
        widget.mgId,
        locale,
        _gameViewInfoJson(),
        _gameConfigJson(),
      );
      if (load['retCode'] != 0) {
        throw StateError('SUD loadGame retCode=${load['retCode']}');
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = error.toString();
        });
      }
    }
  }

  String _gameViewInfoJson() {
    final box = _viewKey.currentContext?.findRenderObject() as RenderBox?;
    final logical = box?.size ?? MediaQuery.sizeOf(context);
    final ratio = MediaQuery.devicePixelRatioOf(context);
    return jsonEncode({
      'ret_code': 0,
      'ret_msg': 'success',
      'view_size': {
        'width': (logical.width * ratio).ceil(),
        'height': (logical.height * ratio).ceil(),
      },
      'view_game_rect': {'left': 0, 'top': 0, 'right': 0, 'bottom': 0},
    });
  }

  String _gameConfigJson() {
    return jsonEncode({
      'gameMode': 1,
      'gameCPU': 0,
      'gameSoundControl': 0,
      'gameSoundVolume': 100,
      'viewScale': 1.0,
      'autoScale': 0,
      'ui': <String, dynamic>{},
    });
  }

  Future<void> _renewCode() async {
    final viewId = _viewId;
    if (viewId == null) return;
    try {
      final session = await widget.repository.getCode(
        roomId: widget.roomId,
        mgId: widget.mgId,
      );
      final code = session['code']?.toString() ?? '';
      if (code.isNotEmpty) await SudGipPlugin.updateCode(viewId, code);
    } catch (error) {
      debugPrint('SUD code renew failed: $error');
    }
  }

  Future<void> _destroy() async {
    final viewId = _viewId;
    if (viewId == null) return;
    try {
      await widget.repository.leaveSession(
        roomId: widget.roomId,
        mgId: widget.mgId,
      );
    } catch (_) {}
    SudGipPlugin.removeFSMGame(viewId);
    SudGipPlugin.destroyGame(viewId);
    SudGipPlugin.dispose(viewId);
    _viewId = null;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final viewId = _viewId;
    if (viewId == null) return;
    if (state == AppLifecycleState.resumed) {
      SudGipPlugin.playGame(viewId);
    } else if (state == AppLifecycleState.paused) {
      SudGipPlugin.pauseGame(viewId);
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _destroy();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Positioned.fill(
          child: Container(
            key: _viewKey,
            color: Colors.black,
            child: _platformView,
          ),
        ),
        if (_loading)
          const Positioned.fill(
            child: Center(child: CircularProgressIndicator()),
          ),
        if (_error != null)
          Positioned.fill(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  _error!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
