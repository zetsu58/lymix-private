from pathlib import Path
import sys

root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('.')
p = root / 'lib/lymix_pro_showcase.dart'
s = p.read_text()

# The authenticated app lands on LymixProShowcase, so patch the actually visible UI.
if "import 'services/session_service.dart';" not in s:
    s = s.replace("import 'services/localization_service.dart';\n", "import 'services/localization_service.dart';\nimport 'services/session_service.dart';\nimport 'services/permanent_room_service.dart';\n")

helper_anchor = "class DiscoverPage extends StatefulWidget {"
helper = r'''Future<void> _openCurrentUsersPermanentRoom(BuildContext context) async {
  try {
    final room = await PermanentRoomService.ensureForCurrentUser();
    if (!context.mounted) return;
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => LymixRoomScreen(
          roomId: room.roomId,
          roomTitle: room.title,
          isPrivateRoom: room.isPrivate,
          totalSeats: room.seats,
        ),
      ),
    );
  } catch (e) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Odan açılamadı: $e')),
    );
  }
}

'''
if '_openCurrentUsersPermanentRoom' not in s:
    s = s.replace(helper_anchor, helper + helper_anchor)

# Discover page: every "my room" affordance should enter the same permanent room.
s = s.replace(
    "onTap:()=>Navigator.push(context,MaterialPageRoute(builder:(_)=>const RoomCreateScreen())))",
    "onTap:()=>_openCurrentUsersPermanentRoom(context))",
)
s = s.replace(
    "onTap:()=>Navigator.push(context,MaterialPageRoute(builder:(_)=>const RoomCreateScreen()))),",
    "onTap:()=>_openCurrentUsersPermanentRoom(context)),",
)
s = s.replace(
    "FilledButton.icon(onPressed:()=>Navigator.push(context,MaterialPageRoute(builder:(_)=>const RoomCreateScreen())),icon:const Icon(Icons.mic_rounded),label:const Text('Odama Git'))",
    "FilledButton.icon(onPressed:()=>_openCurrentUsersPermanentRoom(context),icon:const Icon(Icons.mic_rounded),label:const Text('Odama Git'))",
)

# Replace the hard-coded owner/admin profile with the authenticated user's real profile.
start = s.find('class ProfilePage extends StatelessWidget {')
end = s.find('class _ProfileAction extends StatelessWidget {', start)
if start < 0 or end < 0:
    raise SystemExit('ACTIVE_PROFILE_PAGE_NOT_FOUND')

profile = r'''class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});
  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  SessionUser? user;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final current = await SessionService.user();
    if (!mounted) return;
    setState(() {
      user = current;
      loading = false;
    });
  }

  bool get isSuperAdmin => user?.role.toUpperCase() == 'SUPER_ADMIN';
  String get displayName {
    final u = user;
    if (u == null) return 'Lymix Kullanıcısı';
    if (u.displayName.trim().isNotEmpty) return u.displayName.trim();
    if (u.login.trim().isNotEmpty) return u.login.trim();
    return 'Lymix Kullanıcısı';
  }

  Future<void> _openSelfProfile() async {
    final u = user;
    if (u == null) return;
    if (isSuperAdmin) {
      await Navigator.push(context, MaterialPageRoute(builder: (_) => const SuperAdminProfileScreen()));
    } else {
      await Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => UserProfileScreen(
            userId: u.id,
            displayName: displayName,
            vipLevel: u.level,
            avatarUrl: u.avatarUrl,
          ),
        ),
      );
    }
    if (mounted) _load();
  }

  @override
  Widget build(BuildContext context) {
    final u = user;
    final avatar = u?.avatarUrl;
    final badges = u?.badges ?? const <String>[];
    return ListView(
      padding: const EdgeInsets.only(bottom: 118),
      children: [
        const LymixTopBrandBar(title: 'Profil', subtitle: 'Hesap • kimlik • VIP • ajans'),
        const LymixMediaBanner(
          eyebrow: 'PROFILE',
          title: 'Lymix Identity',
          subtitle: 'VIP • Creator • Agency • Level • Koleksiyon',
          icon: Icons.workspace_premium_rounded,
        ),
        Container(
          margin: const EdgeInsets.fromLTRB(14, 6, 14, 12),
          padding: const EdgeInsets.fromLTRB(15, 17, 15, 15),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF25142F), Color(0xFF130D1C), Color(0xFF0C0912)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: Colors.white.withValues(alpha: .07)),
            boxShadow: [BoxShadow(color: LymixPro.purple.withValues(alpha: .12), blurRadius: 24, offset: const Offset(0, 10))],
          ),
          child: loading
              ? const Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator())
              : Column(children: [
                  Row(children: [
                    GestureDetector(
                      onTap: _openSelfProfile,
                      child: Stack(children: [
                        Container(
                          width: 82,
                          height: 82,
                          padding: const EdgeInsets.all(3),
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: LymixPro.brandGradient,
                            boxShadow: [BoxShadow(color: LymixPro.purple.withValues(alpha: .28), blurRadius: 18)],
                          ),
                          child: CircleAvatar(
                            backgroundColor: const Color(0xFF160F20),
                            backgroundImage: (avatar?.isNotEmpty ?? false) ? NetworkImage(avatar!) : null,
                            child: (avatar?.isNotEmpty ?? false)
                                ? null
                                : Text(
                                    displayName.isEmpty ? 'L' : displayName.characters.first.toUpperCase(),
                                    style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900),
                                  ),
                          ),
                        ),
                        if (isSuperAdmin || badges.any((e) => e.toUpperCase().contains('VERIFIED')))
                          Positioned(
                            right: 0,
                            bottom: 3,
                            child: Container(
                              width: 24,
                              height: 24,
                              decoration: BoxDecoration(
                                color: LymixPalette.gold,
                                shape: BoxShape.circle,
                                border: Border.all(color: LymixPalette.bg, width: 2),
                              ),
                              child: const Icon(Icons.verified_rounded, color: Color(0xFF151018), size: 14),
                            ),
                          ),
                      ]),
                    ),
                    const SizedBox(width: 13),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(displayName, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
                          const SizedBox(height: 4),
                          Text(
                            '${u?.login.isNotEmpty == true ? '@${u!.login} • ' : ''}${isSuperAdmin ? 'Baş Admin' : (u?.role ?? 'USER')}',
                            style: const TextStyle(color: LymixPalette.text3, fontSize: 10),
                          ),
                          const SizedBox(height: 9),
                          Wrap(
                            spacing: 5,
                            runSpacing: 5,
                            children: [
                              if (isSuperAdmin)
                                const LymixPremiumBadge('OWNER', icon: Icons.workspace_premium_rounded),
                              ...badges.take(3).map((b) => LymixPremiumBadge(b.toUpperCase(), icon: Icons.verified_user_rounded)),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_right_rounded, color: LymixPalette.text3),
                  ]),
                  const SizedBox(height: 16),
                  Container(height: 1, color: Colors.white.withValues(alpha: .055)),
                  const SizedBox(height: 13),
                  const Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [_Stat('0', 'Arkadaş'), _Stat('0', 'Takip'), _Stat('0', 'Fan'), _Stat('0', 'Hediye')],
                  ),
                ]),
        ),
        LymixPressable(
          onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const VipCenterScreen())),
          child: Container(
            margin: const EdgeInsets.fromLTRB(14, 0, 14, 12),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [Color(0xFF3B174B), Color(0xFF7D2968), Color(0xFF24123D)]),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.white.withValues(alpha: .07)),
            ),
            child: const Row(children: [
              Icon(Icons.workspace_premium_rounded, color: LymixPalette.gold, size: 31),
              SizedBox(width: 11),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('VIP & Seviye Merkezi', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900)),
                SizedBox(height: 3),
                Text('Ayrıcalıklar • çerçeveler • giriş efektleri', style: TextStyle(color: Colors.white60, fontSize: 9.5)),
              ])),
              Icon(Icons.chevron_right_rounded, color: Colors.white70),
            ]),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: Column(children: [
            LymixMenuTile(
              icon: Icons.graphic_eq_rounded,
              title: 'Kendi Odam',
              subtitle: 'Kalıcı odana doğrudan gir ve yönet',
              onTap: () => _openCurrentUsersPermanentRoom(context),
            ),
            const SizedBox(height: 8),
            LymixMenuTile(
              icon: Icons.card_giftcard_rounded,
              title: context.lx('myGifts'),
              subtitle: 'Hediye kataloğu ve koleksiyon',
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const GiftCatalogScreen())),
            ),
            const SizedBox(height: 8),
            LymixMenuTile(
              icon: Icons.account_balance_wallet_rounded,
              title: context.lx('wallet'),
              subtitle: 'Coin • bakiye • işlem merkezi',
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const WalletScreen())),
            ),
            const SizedBox(height: 8),
            LymixMenuTile(
              icon: Icons.inventory_2_rounded,
              title: context.lx('bag'),
              subtitle: 'Çerçeve • efekt • rozet • varlıklar',
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const InventoryScreen())),
            ),
            const SizedBox(height: 8),
            LymixMenuTile(
              icon: Icons.favorite_rounded,
              title: context.lx('favorites'),
              subtitle: 'Favori oda ve kullanıcıların',
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const FavoritesScreen())),
            ),
            const SizedBox(height: 8),
            LymixMenuTile(
              icon: Icons.verified_user_rounded,
              title: 'Yayıncı Doğrulama',
              subtitle: 'Telefon • canlı video • ajans başvurusu',
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const CreatorVerificationScreen())),
            ),
            const SizedBox(height: 8),
            LymixMenuTile(
              icon: Icons.hub_rounded,
              title: 'Ajans & Aile',
              subtitle: 'Ajans statüsü • host yapısı • topluluk',
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AgencyFamilyScreen())),
            ),
            if (isSuperAdmin) ...[
              const SizedBox(height: 8),
              LymixMenuTile(
                icon: Icons.admin_panel_settings_rounded,
                title: context.lx('adminEconomy'),
                subtitle: 'Baş admin • ekonomi • operasyon',
                onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AdminHybridCenterScreen())),
              ),
              const SizedBox(height: 8),
              LymixMenuTile(
                icon: Icons.payments_rounded,
                title: 'Admin • Coin Gönder',
                subtitle: 'Kullanıcı ID üzerinden operasyon coin transferi',
                onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AdminCoinGrantScreen())),
              ),
            ],
            const SizedBox(height: 8),
            LymixMenuTile(
              icon: Icons.support_agent_rounded,
              title: 'Lymix Official',
              subtitle: 'Sistem rehberi ve resmi destek',
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const OfficialChatScreen())),
            ),
            const SizedBox(height: 8),
            LymixMenuTile(
              icon: Icons.settings_rounded,
              title: context.lx('settings'),
              subtitle: 'Hesap • gizlilik • bildirim • dil',
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AppSettingsScreen())),
            ),
          ]),
        ),
      ],
    );
  }
}

'''
s = s[:start] + profile + s[end:]

# Guard against the fake owner identity reappearing in the visible profile.
if 'LYMIX OWNER' in s or "Text('Baş Admin • Lymix Official'" in s:
    raise SystemExit('HARDCODED_OWNER_PROFILE_STILL_PRESENT')

p.write_text(s)
print('ACTIVE_SHOWCASE_FIXES_APPLIED')
