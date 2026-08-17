from pathlib import Path
import re, sys

root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('.')

# Fix two compact ternaries emitted by the audit patch before Dart analyzer runs.
visual = root / 'lib/widgets/lymix_visual_production.dart'
text = visual.read_text()
text = text.replace('accent.withValues(alpha:animate?.95:.38)', 'accent.withValues(alpha: animate ? .95 : .38)')
text = text.replace('accent.withValues(alpha:animate?.22:.08)', 'accent.withValues(alpha: animate ? .22 : .08)')
visual.write_text(text)

required = [
    'lib/screens/home_screen.dart',
    'lib/screens/room_screen.dart',
    'lib/screens/room_settings_screen.dart',
    'lib/screens/game_center_screen.dart',
    'lib/screens/user_profile_screen.dart',
    'lib/services/session_service.dart',
]
for rel in required:
    if not (root / rel).is_file():
        raise SystemExit(f'MISSING_REQUIRED_FILE: {rel}')

# User-requested room interaction invariants.
room = (root / 'lib/screens/room_screen.dart').read_text()
for needle in [
    'onTap: () => _seatTap(i)',
    'onLongPress:',
    'avatarUrl:current?.avatarUrl',
]:
    if needle not in room.replace(' ', '') if needle == 'avatarUrl:current?.avatarUrl' else needle not in room:
        raise SystemExit(f'ROOM_AUDIT_INVARIANT_MISSING: {needle}')

# Seat strips/contribution pills must be gone from the pedestal widget.
visual_text = visual.read_text()
pedestal_start = visual_text.find('class LymixSeatPedestal')
pedestal_end = visual_text.find('class LymixProfileHero', pedestal_start)
pedestal = visual_text[pedestal_start:pedestal_end]
if "Icon(Icons.diamond_rounded" in pedestal or 'widget.contribution' in pedestal:
    raise SystemExit('SEAT_CONTRIBUTION_STRIP_STILL_PRESENT')
if 'animate?.95' in pedestal or 'animate?.22' in pedestal:
    raise SystemExit('INVALID_DART_TERNARY_STILL_PRESENT')

# Exact empty UI callbacks are treated as production blockers.
dead = []
callback_re = re.compile(r'on(?:Tap|Pressed|LongPress)\s*:\s*\(\)\s*\{\s*\}')
for p in (root / 'lib').rglob('*.dart'):
    data = p.read_text(errors='ignore')
    for m in callback_re.finditer(data):
        line = data.count('\n', 0, m.start()) + 1
        dead.append(f'{p.relative_to(root)}:{line}')
if dead:
    raise SystemExit('DEAD_UI_CALLBACKS: ' + ', '.join(dead))

# The extracted app must not regress to legacy auth calls in the production auth service.
auth_file = root / 'lib/services/auth_service.dart'
if auth_file.exists():
    auth = auth_file.read_text()
    legacy = [x for x in ['/api/auth/login', '/api/auth/register', '/api/auth/refresh'] if x in auth]
    if legacy:
        print('WARNING_LEGACY_AUTH_ROUTES: ' + ', '.join(legacy))
        print('Production auth overlay is handled separately; warning retained for handoff visibility.')

print('MOBILE_AUDIT_FINAL_VERIFICATION_OK')
