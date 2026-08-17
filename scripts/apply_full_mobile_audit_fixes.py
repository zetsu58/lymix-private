from pathlib import Path
import runpy
import sys

root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('.')
script_dir = Path(__file__).resolve().parent

# Keep the large room/home/navigation audit isolated and deterministic.
sys.argv = [str(script_dir / 'apply_full_mobile_audit_core.py'), str(root)]
runpy.run_path(str(script_dir / 'apply_full_mobile_audit_core.py'), run_name='__main__')

# The authenticated application actually lands on LymixProShowcase. Apply the
# visible Discover/Profile fixes after the shared core patch.
sys.argv = [str(script_dir / 'apply_active_showcase_fixes.py'), str(root)]
runpy.run_path(str(script_dir / 'apply_active_showcase_fixes.py'), run_name='__main__')

print('FULL_MOBILE_AUDIT_AND_ACTIVE_SHOWCASE_APPLIED')
