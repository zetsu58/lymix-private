import 'dart:async';

import 'package:agora_rtc_engine/agora_rtc_engine.dart';
import 'package:flutter/foundation.dart';

import 'lymix_agora_repository.dart';

typedef VoiceRoomErrorHandler = void Function(Object error, StackTrace stackTrace);

class LymixVoiceRoomEngine {
  final LymixAgoraRepository repository;
  RtcEngine? _engine;
  RtcEngineEventHandler? _handler;
  String? _joinedRoomId;
  bool _joined = false;
  bool _micMuted = false;
  bool _speakerEnabled = true;

  final _joinedController = StreamController<bool>.broadcast();
  final _remoteUsersController = StreamController<Set<int>>.broadcast();
  final Set<int> _remoteUsers = <int>{};

  VoiceRoomErrorHandler? onError;

  LymixVoiceRoomEngine({required this.repository, this.onError});

  bool get isJoined => _joined;
  bool get micMuted => _micMuted;
  bool get speakerEnabled => _speakerEnabled;
  String? get joinedRoomId => _joinedRoomId;
  Stream<bool> get joinedStream => _joinedController.stream;
  Stream<Set<int>> get remoteUsersStream => _remoteUsersController.stream;

  Future<void> join(String roomId) async {
    if (_joined && _joinedRoomId == roomId) return;
    if (_joined) await leave();

    try {
      final auth = await repository.tokenForRoom(roomId);
      final engine = createAgoraRtcEngine();
      _engine = engine;

      await engine.initialize(RtcEngineContext(appId: auth.appId));

      _handler = RtcEngineEventHandler(
        onError: (errorCode, message) {
          onError?.call(
            StateError('Agora error $errorCode: $message'),
            StackTrace.current,
          );
        },
        onJoinChannelSuccess: (connection, elapsed) {
          _joined = true;
          _joinedRoomId = roomId;
          _joinedController.add(true);
          debugPrint('Agora joined ${connection.channelId} in ${elapsed}ms');
        },
        onLeaveChannel: (connection, stats) {
          _joined = false;
          _joinedRoomId = null;
          _remoteUsers.clear();
          _remoteUsersController.add(Set<int>.unmodifiable(_remoteUsers));
          _joinedController.add(false);
        },
        onUserJoined: (connection, remoteUid, elapsed) {
          _remoteUsers.add(remoteUid);
          _remoteUsersController.add(Set<int>.unmodifiable(_remoteUsers));
        },
        onUserOffline: (connection, remoteUid, reason) {
          _remoteUsers.remove(remoteUid);
          _remoteUsersController.add(Set<int>.unmodifiable(_remoteUsers));
        },
      );

      engine.registerEventHandler(_handler!);
      await engine.enableAudio();
      await engine.setClientRole(role: ClientRoleType.clientRoleBroadcaster);
      await engine.setAudioProfile(
        profile: AudioProfileType.audioProfileDefault,
        scenario: AudioScenarioType.audioScenarioGameStreaming,
      );
      await engine.setEnableSpeakerphone(true);

      await engine.joinChannelWithUserAccount(
        token: auth.token,
        channelId: auth.channelName,
        userAccount: auth.userAccount,
        options: const ChannelMediaOptions(
          channelProfile: ChannelProfileType.channelProfileLiveBroadcasting,
          clientRoleType: ClientRoleType.clientRoleBroadcaster,
          publishMicrophoneTrack: true,
          autoSubscribeAudio: true,
          autoSubscribeVideo: false,
        ),
      );
    } catch (error, stackTrace) {
      await _releaseEngine();
      onError?.call(error, stackTrace);
      rethrow;
    }
  }

  Future<void> setMicrophoneMuted(bool muted) async {
    final engine = _engine;
    if (engine == null) return;
    await engine.muteLocalAudioStream(muted);
    _micMuted = muted;
  }

  Future<void> setSpeakerEnabled(bool enabled) async {
    final engine = _engine;
    if (engine == null) return;
    await engine.setEnableSpeakerphone(enabled);
    _speakerEnabled = enabled;
  }

  Future<void> muteRemoteUser(int uid, bool mute) async {
    final engine = _engine;
    if (engine == null) return;
    await engine.muteRemoteAudioStream(uid: uid, mute: mute);
  }

  Future<void> muteAllRemote(bool mute) async {
    final engine = _engine;
    if (engine == null) return;
    await engine.muteAllRemoteAudioStreams(mute);
  }

  Future<void> renewToken(String roomId) async {
    final engine = _engine;
    if (engine == null || !_joined) return;
    final auth = await repository.tokenForRoom(roomId);
    await engine.renewToken(auth.token);
  }

  Future<void> leave() async {
    final engine = _engine;
    if (engine == null) return;
    try {
      await engine.leaveChannel();
    } finally {
      await _releaseEngine();
    }
  }

  Future<void> _releaseEngine() async {
    final engine = _engine;
    final handler = _handler;
    _engine = null;
    _handler = null;
    _joined = false;
    _joinedRoomId = null;
    _micMuted = false;
    _speakerEnabled = true;
    _remoteUsers.clear();
    _remoteUsersController.add(Set<int>.unmodifiable(_remoteUsers));
    _joinedController.add(false);

    if (engine != null) {
      if (handler != null) engine.unregisterEventHandler(handler);
      await engine.release();
    }
  }

  Future<void> dispose() async {
    await leave();
    await _joinedController.close();
    await _remoteUsersController.close();
  }
}
