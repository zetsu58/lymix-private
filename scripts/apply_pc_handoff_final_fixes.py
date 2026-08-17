from pathlib import Path
import sys

root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('.')

def write(rel, content):
    p = root / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content)
    print('PC_HANDOFF_PATCHED', rel)

# Keep device/session management on the production session API.
write('lib/screens/device_sessions_screen.dart', r'''import 'package:flutter/material.dart';
import '../core/api_client.dart';
import '../services/session_service.dart';
import '../theme/lymix_theme.dart';
import '../widgets/lymix_states.dart';
class DeviceSessionsScreen extends StatefulWidget{const DeviceSessionsScreen({super.key});@override State<DeviceSessionsScreen> createState()=>_DeviceSessionsScreenState();}
class _DeviceSessionsScreenState extends State<DeviceSessionsScreen>{bool loading=true;String? error;List<Map<String,dynamic>> rows=[];ApiClient get api=>const ApiClient(tokenProvider:SessionService.token);@override void initState(){super.initState();_load();}
Future<void> _load()async{setState((){loading=true;error=null;});try{final data=await api.getJson('/api/v1/sessions');final list=(data as List? ?? const []).whereType<Map>().map((e)=>Map<String,dynamic>.from(e)).toList();if(mounted)setState((){rows=list;loading=false;});}catch(e){if(mounted)setState((){error=e.toString();loading=false;});}}
Future<void> _revoke(String id)async{try{await api.deleteJson('/api/v1/sessions/$id',{});await _load();}catch(e){if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text('Oturum kapatılamadı: $e')));}}
@override Widget build(BuildContext context)=>Scaffold(appBar:AppBar(title:const Text('Cihazlar ve Oturumlar')),body:RefreshIndicator(color:LymixColors.gold,onRefresh:_load,child:ListView(physics:const AlwaysScrollableScrollPhysics(),padding:const EdgeInsets.fromLTRB(16,10,16,28),children:[if(loading)const LymixLoadingCard(label:'Oturumların yükleniyor...')else if(error!=null)LymixStateCard(icon:Icons.devices_other_rounded,title:'Oturumlar yüklenemedi',message:error!,actionLabel:'Tekrar dene',onAction:_load)else if(rows.isEmpty)const LymixStateCard(icon:Icons.devices_rounded,title:'Aktif oturum bulunamadı',message:'Giriş yaptığın cihazlar burada listelenecek.')else ...rows.map((r){final d=r['device'] is Map?Map<String,dynamic>.from(r['device'] as Map):const<String,dynamic>{};final current=r['current']==true;return Container(margin:const EdgeInsets.only(bottom:9),padding:const EdgeInsets.all(13),decoration:BoxDecoration(color:LymixColors.surface,borderRadius:BorderRadius.circular(18),border:Border.all(color:Colors.white.withValues(alpha:.05))),child:Row(children:[Container(width:42,height:42,decoration:BoxDecoration(color:const Color(0x14FFD643),borderRadius:BorderRadius.circular(13)),child:Icon('${d['platform']??''}'.toLowerCase().contains('ios')?Icons.phone_iphone_rounded:Icons.android_rounded,color:LymixColors.gold)),const SizedBox(width:10),Expanded(child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[Text('${d['deviceName']??'Cihaz'}',style:const TextStyle(fontWeight:FontWeight.w800,fontSize:11.5)),Text('${d['platform']??''} • ${d['appVersion']??''}${current?' • Bu cihaz':''}',style:const TextStyle(color:Colors.white38,fontSize:9))])),if(current)const Icon(Icons.verified_rounded,color:LymixColors.gold)else IconButton(tooltip:'Bu oturumu kapat',onPressed:()=>_revoke('${r['id']??''}'),icon:const Icon(Icons.logout_rounded,color:Colors.white54))]));})])));
}
''')

# Profile API is the live source of truth; secure session cache is fallback.
write('lib/services/profile_service.dart', r'''import '../core/api_client.dart';
import 'session_service.dart';
class ProfileService{final ApiClient api;const ProfileService(this.api);Future<SessionUser> me()async{final data=Map<String,dynamic>.from(await api.getJson('/api/v1/me') as Map);final user=SessionUser.fromJson(data);final access=await SessionService.token()??'';final refresh=await SessionService.refreshToken()??'';if(access.isNotEmpty&&refresh.isNotEmpty)await SessionService.updateTokens(accessToken:access,refreshToken:refresh,sessionId:await SessionService.sessionId(),user:user);return user;}Future<Map<String,dynamic>> update({String? displayName,String? avatarUrl,String? bio,String? language})async=>Map<String,dynamic>.from(await api.patchJson('/api/v1/me',{'displayName':displayName,'avatarUrl':avatarUrl,'bio':bio,'language':language}..removeWhere((k,v)=>v==null)) as Map);}
''')

showcase = root / 'lib/lymix_pro_showcase.dart'
s = showcase.read_text()
if "import 'services/profile_service.dart';" not in s:
    s = s.replace("import 'services/permanent_room_service.dart';\n", "import 'services/permanent_room_service.dart';\nimport 'services/profile_service.dart';\nimport 'core/api_client.dart';\n")
s = s.replace("  Future<void> _load() async {\n    final current = await SessionService.user();\n    if (!mounted) return;\n    setState(() {\n      user = current;\n      loading = false;\n    });\n  }", "  Future<void> _load() async {\n    SessionUser? current;\n    try { current = await ProfileService(const ApiClient(tokenProvider: SessionService.token)).me(); } catch (_) { current = await SessionService.user(); }\n    if (!mounted) return;\n    setState(() { user = current; loading = false; });\n  }")
showcase.write_text(s)

# Do not delete embedded folders here: current hardened Codemagic validates them.
# The materializer excludes stale embedded backend/admin copies only from the final PC mobile ZIP.
(root / 'README_INTEGRATED_SOURCE_TR.md').write_text('''# LYMIX V21.22.1 Integrated Flutter Source\n\nBu kaynak production auth/session/profile/wallet, doğrudan kalıcı oda, oda navigation, koltuk tek dokunuş otur/kalk, native SUD Game Center ve Lymix launch entegrasyonları uygulanarak üretilir.\n\nProduction backend ve admin web GitHub repo kökündeki `backend/` ve `admin-web/` klasörleridir. `scripts/materialize_integrated_flutter_source.py` final mobil ZIP oluştururken eski gömülü backend/admin kopyalarını dışarıda bırakır.\n\nVS Code: `flutter pub get` -> `flutter analyze` -> `flutter test` -> gerçek cihaz testi. SUD/Agora/Store secret ve credential değerleri source code içine yazılmaz.\n''')

print('PC_HANDOFF_FINAL_FIXES_APPLIED')
