from __future__ import annotations

import hashlib
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
WORK = REPO / '.generated' / 'lymix_integrated'
EXTRACT = REPO / '.generated' / 'source_extract'
DIST = REPO / 'dist'
OUT = DIST / 'LYMIX_V21_22_1_INTEGRATED_FLUTTER_SOURCE.zip'
EXPECTED_VERSION = '21.22.0+237'


def fail(message: str) -> None:
    raise SystemExit(message)


def unzip(src: Path, dst: Path) -> None:
    with zipfile.ZipFile(src) as z:
        bad = z.testzip()
        if bad:
            fail(f'ZIP_CRC_ERROR: {src} -> {bad}')
        z.extractall(dst)


def find_source_zip() -> Path:
    preferred = []
    for pattern in (
        'LYMIX_V21_22_BUILD_FIXES_CODEMAGIC_HARDENED.zip',
        'LYMIX_V21_22_1_ANALYZER_FIX_CODEMAGIC_READY.zip',
        '*ANALYZER_FIX_CODEMAGIC_READY*.zip',
        '*BUILD_FIXES_CODEMAGIC_HARDENED*.zip',
    ):
        preferred.extend(REPO.glob(pattern))
    if preferred:
        return sorted(set(preferred))[0]

    bundles = sorted(REPO.glob('*CODEMAGIC_GITHUB_BUNDLE*.zip'))
    if not bundles:
        fail('SOURCE_BUNDLE_NOT_FOUND')
    bundle_dir = REPO / '.generated' / 'bundle_extract'
    shutil.rmtree(bundle_dir, ignore_errors=True)
    bundle_dir.mkdir(parents=True, exist_ok=True)
    unzip(bundles[0], bundle_dir)
    nested = sorted(p for p in bundle_dir.rglob('*.zip') if 'CODEMAGIC_GITHUB_BUNDLE' not in p.name)
    if not nested:
        fail('NESTED_SOURCE_ZIP_NOT_FOUND')
    return nested[0]


def find_project(root: Path) -> Path:
    for pubspec in root.rglob('pubspec.yaml'):
        project = pubspec.parent
        if (project / 'lib' / 'main.dart').is_file():
            return project
    fail('FLUTTER_PROJECT_NOT_FOUND')
    raise AssertionError


def read_version(project: Path) -> str:
    for line in (project / 'pubspec.yaml').read_text(encoding='utf-8').splitlines():
        if line.startswith('version:'):
            return line.split(':', 1)[1].strip()
    return ''


def run_patch(name: str) -> None:
    script = REPO / 'scripts' / name
    if not script.is_file():
        fail(f'MISSING_PATCH_SCRIPT: {name}')
    print(f'>>> {name}')
    subprocess.run([sys.executable, str(script), str(WORK)], cwd=REPO, check=True)


def verify_mobile_source() -> None:
    required = [
        'lib/main.dart',
        'lib/lymix_pro_showcase.dart',
        'lib/features/launch/lymix_launch_screen.dart',
        'lib/screens/room_screen.dart',
        'lib/screens/room_settings_screen.dart',
        'lib/screens/game_center_screen.dart',
        'lib/screens/sud_game_screen.dart',
        'lib/screens/register_screen.dart',
        'lib/screens/device_sessions_screen.dart',
        'lib/services/auth_service.dart',
        'lib/services/session_service.dart',
        'lib/services/profile_service.dart',
        'lib/services/wallet_service.dart',
        'lib/core/api_client.dart',
        'pubspec.yaml',
    ]
    missing = [rel for rel in required if not (WORK / rel).is_file()]
    if missing:
        fail('INTEGRATED_SOURCE_MISSING: ' + ', '.join(missing))

    all_dart = '\n'.join(p.read_text(encoding='utf-8', errors='ignore') for p in (WORK / 'lib').rglob('*.dart'))
    for legacy in ('/api/auth/login', '/api/auth/register', '/api/auth/refresh'):
        if legacy in all_dart:
            fail(f'LEGACY_AUTH_ROUTE_ACTIVE: {legacy}')

    room = (WORK / 'lib/screens/room_screen.dart').read_text(encoding='utf-8')
    for needle in ('_seatTap(i)', 'onLongPress:', 'avatarUrl:current?.avatarUrl'):
        if needle.replace(' ', '') not in room.replace(' ', ''):
            fail(f'ROOM_INVARIANT_MISSING: {needle}')

    profile = (WORK / 'lib/lymix_pro_showcase.dart').read_text(encoding='utf-8')
    for needle in ('_openCurrentUsersPermanentRoom', "ID: ${u?.id", 'ProfileService'):
        if needle not in profile:
            fail(f'PROFILE_INVARIANT_MISSING: {needle}')

    launch = (WORK / 'lib/features/launch/lymix_launch_screen.dart').read_text(encoding='utf-8')
    if 'required this.next' not in launch or 'Sesinle Bağlan, Dünyanı Paylaş' not in launch:
        fail('LAUNCH_INTEGRATION_INVALID')

    game = (WORK / 'lib/screens/sud_game_screen.dart').read_text(encoding='utf-8')
    for needle in ('SudGipPlugin.initSDK', 'SudGipPlugin.loadGame', 'SudGipPlugin.updateCode', '/api/games/sud/get-code'):
        if needle not in game:
            fail(f'SUD_INVARIANT_MISSING: {needle}')


def build_zip() -> str:
    DIST.mkdir(parents=True, exist_ok=True)
    if OUT.exists():
        OUT.unlink()

    excluded_roots = {'backend', 'admin_web', 'admin-web', '.dart_tool', 'build', '.git'}
    with zipfile.ZipFile(OUT, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for path in sorted(WORK.rglob('*')):
            rel = path.relative_to(WORK)
            if not rel.parts or rel.parts[0] in excluded_roots:
                continue
            if path.is_file() and path.suffix not in {'.apk', '.aab'}:
                z.write(path, rel.as_posix())

    with zipfile.ZipFile(OUT) as z:
        bad = z.testzip()
        if bad:
            fail(f'OUTPUT_ZIP_CRC_ERROR: {bad}')

    digest = hashlib.sha256(OUT.read_bytes()).hexdigest()
    print(f'OUTPUT={OUT}')
    print(f'SHA256={digest}')
    print(f'SIZE={OUT.stat().st_size}')
    return digest


def main() -> None:
    shutil.rmtree(WORK, ignore_errors=True)
    shutil.rmtree(EXTRACT, ignore_errors=True)
    WORK.parent.mkdir(parents=True, exist_ok=True)
    EXTRACT.mkdir(parents=True, exist_ok=True)

    source_zip = find_source_zip()
    print(f'SOURCE_ZIP={source_zip}')
    unzip(source_zip, EXTRACT)
    project = find_project(EXTRACT)
    if read_version(project) != EXPECTED_VERSION:
        fail(f'VERSION_MISMATCH: expected {EXPECTED_VERSION}, found {read_version(project)}')
    shutil.copytree(project, WORK)

    run_patch('apply_full_mobile_audit_fixes.py')
    run_patch('verify_and_finalize_mobile_audit.py')
    verify_mobile_source()
    build_zip()
    print('LYMIX_INTEGRATED_SOURCE_READY')


if __name__ == '__main__':
    main()
