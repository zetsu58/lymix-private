from pathlib import Path
import runpy
import sys

root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('.')
script_dir = Path(__file__).resolve().parent

sys.argv = [str(script_dir / 'apply_full_mobile_audit_core.py'), str(root)]
runpy.run_path(str(script_dir / 'apply_full_mobile_audit_core.py'), run_name='__main__')

sys.argv = [str(script_dir / 'apply_active_showcase_fixes.py'), str(root)]
runpy.run_path(str(script_dir / 'apply_active_showcase_fixes.py'), run_name='__main__')

sys.argv = [str(script_dir / 'apply_showcase_constructor_hotfix.py'), str(root)]
runpy.run_path(str(script_dir / 'apply_showcase_constructor_hotfix.py'), run_name='__main__')

sys.argv = [str(script_dir / 'apply_api_contract_fixes.py'), str(root)]
runpy.run_path(str(script_dir / 'apply_api_contract_fixes.py'), run_name='__main__')

sys.argv = [str(script_dir / 'apply_reference_video_ux_fixes.py'), str(root)]
runpy.run_path(str(script_dir / 'apply_reference_video_ux_fixes.py'), run_name='__main__')

sys.argv = [str(script_dir / 'apply_pc_handoff_final_fixes.py'), str(root)]
runpy.run_path(str(script_dir / 'apply_pc_handoff_final_fixes.py'), run_name='__main__')

print('FULL_MOBILE_AUDIT_REFERENCE_UX_AND_PC_HANDOFF_APPLIED')
