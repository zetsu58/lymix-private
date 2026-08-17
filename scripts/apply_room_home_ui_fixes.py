from pathlib import Path
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else 'source/Lymix')

def replace_required(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing patch target: {label}')
    return text.replace(old, new, 1)

# room_screen.dart
p = root / 'lib/screens/room_screen.dart'
s = p.read_text()
if "../services/session_service.dart" not in s:
    s = replace_required(s, "import '../services/room_membership_service.dart';", "import '../services/room_membership_service.dart';\nimport '../services/session_service.dart';", 'room session import')
s = replace_required(s, "          onTap: () => occupied ? _showSeatUserProfile(i) : _showSeatActions(i),", "          onTap: () => _seatTap(i),\n          onLongPress: (currentUserIsRoomOwner || currentUserIsRoomAdmin) ? () => _showAdminSeatMenu(i) : null,", 'seat primary action')
s = replace_required(s, """    // Oda sahibi veya admin koltuğa dokunduğunda yönetim menüsü açılır.\n    if (currentUserIsRoomOwner || currentUserIsRoomAdmin) {\n      _showAdminSeatMenu(i);\n      return;\n    }\n\n    // Normal yayıncı/kullanıcı boş ve açık koltuğa tek dokunuşla doğrudan oturur.\n    if (s.status == SeatStatus.locked) {\n      _info('Koltuk kilitli', '${i + 1}. koltuk oda sahibi veya yetkili tarafından kilitlendi.');\n      return;\n    }\n""", """    // Tek dokunuş = otur/kalk/profil. Yönetim menüsü yalnız uzun basışta açılır.\n    if (s.status == SeatStatus.locked) {\n      if (currentUserIsRoomOwner || currentUserIsRoomAdmin) {\n        _showAdminSeatMenu(i);\n      } else {\n        _info('Koltuk kilitli', '${i + 1}. koltuk oda sahibi veya yetkili tarafından kilitlendi.');\n      }\n      return;\n    }\n""", 'owner double tap')
s = replace_required(s, """  void _sitOnSeat(int i) {\n    if (seats[i].status != SeatStatus.empty || mySeat != -1) return;\n    setState(() {\n      mySeat = i;\n      seats[i] = RoomSeat(index:i,status:SeatStatus.occupied,userId:'me',userName:'Siz',avatarUrl:null);\n    });\n    _playVipEntrance('Siz',3);\n  }\n""", """  Future<void> _sitOnSeat(int i) async {\n    if (seats[i].status != SeatStatus.empty || mySeat != -1) return;\n    final current = await SessionService.user();\n    if (!mounted || seats[i].status != SeatStatus.empty || mySeat != -1) return;\n    final displayName = (current?.displayName.isNotEmpty ?? false) ? current!.displayName : 'Siz';\n    setState(() {\n      mySeat = i;\n      seats[i] = RoomSeat(\n        index: i,\n        status: SeatStatus.occupied,\n        userId: current?.id.isNotEmpty == true ? current!.id : 'me',\n        userName: displayName,\n        avatarUrl: current?.avatarUrl,\n      );\n    });\n    _playVipEntrance(displayName, 3);\n  }\n""", 'seat avatar')
p.write_text(s)

# lymix_visual_production.dart
p = root / 'lib/widgets/lymix_visual_production.dart'
s = p.read_text()
idx = s.index('class LymixSeatPedestal')
pre, seat = s[:idx], s[idx:]
seat = replace_required(seat, "  final VoidCallback? onTap;\n  const LymixSeatPedestal({", "  final VoidCallback? onTap;\n  final VoidCallback? onLongPress;\n  const LymixSeatPedestal({", 'seat long press field')
seat = replace_required(seat, "    this.onTap,\n  });", "    this.onTap,\n    this.onLongPress,\n  });", 'seat long press ctor')
seat = replace_required(seat, "      onTap: widget.onTap,\n      child: Column", "      onTap: widget.onTap,\n      onLongPress: widget.onLongPress,\n      child: Column", 'seat long press gesture')
stripe = """              Positioned(\n                bottom: -3,\n                child: Container(\n                  width: 42, height: 9,\n                  decoration: BoxDecoration(\n                    borderRadius: BorderRadius.circular(999),\n                    gradient: LinearGradient(\n                      colors: [\n                        accent.withValues(alpha: .18),\n                        accent.withValues(alpha: .65),\n                        accent.withValues(alpha: .18),\n                      ],\n                    ),\n                    boxShadow: [\n                      BoxShadow(color: accent.withValues(alpha: .25), blurRadius: 10),\n                    ],\n                  ),\n                ),\n              ),\n"""
seat = replace_required(seat, stripe, '', 'seat accent stripe')
pill = """        const SizedBox(height: 3),\n        Container(\n          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),\n          decoration: BoxDecoration(\n            color: accent.withValues(alpha: .10),\n            borderRadius: BorderRadius.circular(999),\n            border: Border.all(color: accent.withValues(alpha: .18)),\n          ),\n          child: Row(mainAxisSize: MainAxisSize.min, children: [\n            Icon(Icons.diamond_rounded, size: 8, color: accent),\n            const SizedBox(width: 3),\n            Text(widget.contribution,\n              style: TextStyle(color: accent, fontSize: 7.8, fontWeight: FontWeight.w900)),\n          ]),\n        ),\n"""
seat = replace_required(seat, pill, '', 'seat contribution strip')
p.write_text(pre + seat)

# session_service.dart: retain profile avatar for seat rendering
p = root / 'lib/services/session_service.dart'
s = p.read_text()
if 'final String? avatarUrl;' not in s:
    s = replace_required(s, '  final List<String> badges;', '  final List<String> badges;\n  final String? avatarUrl;', 'avatar field')
    s = replace_required(s, '    required this.badges,\n  });', '    required this.badges,\n    this.avatarUrl,\n  });', 'avatar ctor')
    start = s.index('  factory SessionUser.fromJson')
    end = s.index('\n\n  Map<String, dynamic> toJson()', start)
    factory = """  factory SessionUser.fromJson(Map<String, dynamic> json) {\n    final profile = json['profile'] is Map\n        ? Map<String, dynamic>.from(json['profile'] as Map)\n        : const <String, dynamic>{};\n    return SessionUser(\n      id: '${json['id'] ?? ''}',\n      login: '${json['username'] ?? json['login'] ?? ''}',\n      displayName: '${profile['displayName'] ?? json['displayName'] ?? json['name'] ?? ''}',\n      role: '${json['role'] ?? 'user'}',\n      level: (profile['level'] as num?)?.toInt() ?? (json['level'] as num?)?.toInt() ?? 1,\n      badges: (profile['badges'] as List? ?? json['badges'] as List? ?? const []).map((e) => '$e').toList(),\n      avatarUrl: profile['avatarUrl']?.toString() ?? json['avatarUrl']?.toString(),\n    );\n  }"""
    s = s[:start] + factory + s[end:]
    s = replace_required(s, "    'badges': badges,\n  };", "    'badges': badges,\n    'avatarUrl': avatarUrl,\n  };", 'avatar toJson')
p.write_text(s)

# home_screen.dart dead actions
p = root / 'lib/screens/home_screen.dart'
s = p.read_text()
s = s.replace("_sectionTitle('Sana Özel Odalar', 'Tümünü Gör'),", "_sectionTitle('Sana Özel Odalar', 'Tümünü Gör', () => setState(() => tab = 2)),")
s = s.replace("_sectionTitle('Anlar', 'Daha Fazla'),", "_sectionTitle('Anlar', 'Daha Fazla', () => Navigator.push(context, MaterialPageRoute(builder: (_) => const FeedScreen()))),")
s = s.replace("_sectionTitle('Akıllı Eşleşmeler', 'Yenile'),", "_sectionTitle('Akıllı Eşleşmeler', 'Keşfet', () => setState(() => tab = 1)),")
s = replace_required(s, 'Widget _sectionTitle(String title, String action) => Padding(', 'Widget _sectionTitle(String title, String action, VoidCallback onTap) => Padding(', 'home section callback')
s = replace_required(s, "      Text(action, style: const TextStyle(color: LymixColors.gold, fontSize: 12, fontWeight: FontWeight.w700)),", "      TextButton(onPressed: onTap, style: TextButton.styleFrom(foregroundColor: LymixColors.gold, visualDensity: VisualDensity.compact), child: Text(action, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700))),", 'home section button')
s = s.replace("_featureStrip('🎙️', 'Sesli Parti', 'Binlerce konu odası arasından seç', () {}),", "_featureStrip('🎙️', 'Sesli Parti', 'Kendi odanı aç veya aktif odalara katıl', () => Navigator.push(context, MaterialPageRoute(builder: (_) => const RoomCreateScreen()))),")
s = s.replace("_featureStrip('⚔️', 'PK Savaşı', 'Takımını kur, puan topla, liderlik tablosuna çık', () {}),", "_featureStrip('⚔️', 'PK Savaşı', 'PK bir oda içinde başlatılır', () => Navigator.push(context, MaterialPageRoute(builder: (_) => const RoomCreateScreen()))),")
s = s.replace("_featureStrip('🎲', 'Mini Oyunlar', 'Ludo ve oda içi oyunlarla sohbeti hareketlendir', () {}),", "_featureStrip('🎲', 'Mini Oyunlar', 'Ludo ve oda içi oyunlarla sohbeti hareketlendir', () => Navigator.push(context, MaterialPageRoute(builder: (_) => const GameCenterScreen()))),")
p.write_text(s)

print('Lymix room/home UI fixes applied.')
