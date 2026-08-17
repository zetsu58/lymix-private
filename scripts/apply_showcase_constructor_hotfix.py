from pathlib import Path
import sys

root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('.')
p = root / 'lib/lymix_pro_showcase.dart'
s = p.read_text()
s = s.replace(
    "          isPrivateRoom: room.isPrivate,\n          totalSeats: room.seats,\n",
    "          isPrivateRoom: room.isPrivate,\n          currentUserIsOwner: true,\n",
)
if 'totalSeats: room.seats' in s:
    raise SystemExit('ROOM_CONSTRUCTOR_TOTAL_SEATS_STILL_PRESENT')
if 'currentUserIsOwner: true' not in s:
    raise SystemExit('OWN_ROOM_OWNER_FLAG_MISSING')
p.write_text(s)
print('SHOWCASE_ROOM_CONSTRUCTOR_HOTFIX_APPLIED')
