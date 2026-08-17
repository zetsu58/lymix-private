from pathlib import Path
import sys

root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('.')

def write(rel, content):
    p = root / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content)
    print('API_CONTRACT_PATCHED', rel)

write('lib/core/api_client.dart', r'''import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'app_config.dart';
import '../services/session_service.dart';

class ApiException implements Exception {
  final String message;
  final int? statusCode;
  final String? code;
  const ApiException(this.message, {this.statusCode, this.code});
  @override String toString() => message;
}

class ApiClient {
  final Future<String?> Function()? tokenProvider;
  const ApiClient({this.tokenProvider});
  static Future<bool>? _refreshInFlight;

  Uri _uri(String path) => Uri.parse('${AppConfig.apiBase}${path.startsWith('/') ? path : '/$path'}');

  Future<Map<String, String>> _headers() async {
    final token = await tokenProvider?.call();
    return {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
    };
  }

  Future<dynamic> getJson(String path, {Duration timeout = const Duration(seconds: 10)}) =>
      _request('GET', path, null, timeout: timeout);

  Future<dynamic> postJson(String path, Object? body, {Duration timeout = const Duration(seconds: 12)}) =>
      _request('POST', path, body, timeout: timeout);

  Future<dynamic> patchJson(String path, Object? body, {Duration timeout = const Duration(seconds: 12)}) =>
      _request('PATCH', path, body, timeout: timeout);

  Future<dynamic> deleteJson(String path, Object? body, {Duration timeout = const Duration(seconds: 12)}) =>
      _request('DELETE', path, body, timeout: timeout);

  Future<dynamic> _request(String method, String path, Object? body, {required Duration timeout, bool retry401 = true}) async {
    try {
      final uri = _uri(path);
      final headers = await _headers();
      late http.Response r;
      switch (method) {
        case 'GET': r = await http.get(uri, headers: headers).timeout(timeout); break;
        case 'POST': r = await http.post(uri, headers: headers, body: jsonEncode(body)).timeout(timeout); break;
        case 'PATCH': r = await http.patch(uri, headers: headers, body: jsonEncode(body)).timeout(timeout); break;
        case 'DELETE': r = await http.delete(uri, headers: headers, body: jsonEncode(body)).timeout(timeout); break;
        default: throw const ApiException('Desteklenmeyen HTTP metodu.', code: 'http_method');
      }
      if (r.statusCode == 401 && retry401 && tokenProvider != null && await _refreshAccess()) {
        return _request(method, path, body, timeout: timeout, retry401: false);
      }
      return _decode(r);
    } on TimeoutException {
      throw const ApiException('Sunucu yanıt vermedi. Bağlantını kontrol edip tekrar dene.', code: 'timeout');
    } on ApiException {
      rethrow;
    } catch (_) {
      throw const ApiException('Ağa bağlanılamadı. İnternet bağlantını kontrol et.', code: 'network');
    }
  }

  Future<bool> _refreshAccess() async {
    final existing = _refreshInFlight;
    if (existing != null) return existing;
    final future = _doRefresh();
    _refreshInFlight = future;
    try { return await future; } finally { _refreshInFlight = null; }
  }

  Future<bool> _doRefresh() async {
    final refresh = await SessionService.refreshToken();
    if (refresh == null || refresh.isEmpty) return false;
    try {
      final r = await http.post(
        _uri('/api/v1/auth/refresh'),
        headers: const {'Accept':'application/json','Content-Type':'application/json'},
        body: jsonEncode({'refreshToken': refresh}),
      ).timeout(const Duration(seconds: 12));
      if (r.statusCode < 200 || r.statusCode >= 300) {
        await SessionService.clear();
        return false;
      }
      final data = jsonDecode(r.body) as Map<String, dynamic>;
      final rawUser = data['user'];
      final user = rawUser is Map ? SessionUser.fromJson(Map<String, dynamic>.from(rawUser)) : await SessionService.user();
      await SessionService.updateTokens(
        accessToken: '${data['accessToken'] ?? ''}',
        refreshToken: '${data['refreshToken'] ?? refresh}',
        sessionId: data['sessionId']?.toString(),
        user: user,
      );
      return '${data['accessToken'] ?? ''}'.isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  Future<dynamic> postMultipart(String path, {required Map<String,String> fields, String? fileField, String? filePath, Duration timeout = const Duration(seconds:45)}) async {
    try {
      final token = await tokenProvider?.call();
      final req = http.MultipartRequest('POST', _uri(path));
      req.headers['Accept'] = 'application/json';
      if (token != null && token.isNotEmpty) req.headers['Authorization'] = 'Bearer $token';
      req.fields.addAll(fields);
      if (fileField != null && filePath != null && filePath.isNotEmpty) req.files.add(await http.MultipartFile.fromPath(fileField, filePath));
      final streamed = await req.send().timeout(timeout);
      final response = await http.Response.fromStream(streamed);
      return _decode(response);
    } on TimeoutException {
      throw const ApiException('Dosya yükleme zaman aşımına uğradı.', code:'timeout');
    } on ApiException { rethrow; } catch (_) {
      throw const ApiException('Dosya yüklenemedi. Bağlantını kontrol et.', code:'network');
    }
  }

  dynamic _decode(http.Response r) {
    dynamic body;
    try { body = r.body.isEmpty ? null : jsonDecode(r.body); } catch (_) { body = r.body; }
    if (r.statusCode >= 200 && r.statusCode < 300) return body;
    final msg = body is Map ? (body['message'] ?? body['error'] ?? body['code'] ?? 'İşlem tamamlanamadı.') : 'İşlem tamamlanamadı.';
    final code = body is Map ? (body['code'] ?? body['error'])?.toString() : null;
    throw ApiException(msg.toString(), statusCode:r.statusCode, code:code);
  }
}
''')

write('lib/screens/device_sessions_screen.dart', r'''import 'package:flutter/material.dart';
import '../core/api_client.dart';
import '../services/session_service.dart';
import '../theme/lymix_theme.dart';
import '../widgets/lymix_states.dart';

class DeviceSessionsScreen extends StatefulWidget {
  const DeviceSessionsScreen({super.key});
  @override State<DeviceSessionsScreen> createState()=>_DeviceSessionsScreenState();
}

class _DeviceSessionsScreenState extends State<DeviceSessionsScreen>{
  bool loading=true; String? error; List<Map<String,dynamic>> rows=[];
  ApiClient get api=>const ApiClient(tokenProvider:SessionService.token);
  @override void initState(){super.initState();_load();}
  Future<void> _load() async{
    setState((){loading=true;error=null;});
    try{
      final data=await api.getJson('/api/v1/sessions');
      final list=(data as List? ?? const[]).whereType<Map>().map((e)=>Map<String,dynamic>.from(e)).toList();
      if(mounted)setState((){rows=list;loading=false;});
    }catch(e){if(mounted)setState((){error=e.toString();loading=false;});}
  }
  Future<void> _revoke(String id) async{
    try{await api.deleteJson('/api/v1/sessions/$id',{});await _load();}
    catch(e){if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text('$e')));}
  }
  @override Widget build(BuildContext context)=>Scaffold(
    appBar:AppBar(title:const Text('Cihazlar ve Oturumlar')),
    body:RefreshIndicator(color:LymixColors.gold,onRefresh:_load,child:ListView(
      physics:const AlwaysScrollableScrollPhysics(),padding:const EdgeInsets.fromLTRB(16,10,16,28),children:[
        if(loading) const LymixLoadingCard(label:'Oturumların yükleniyor...')
        else if(error!=null) LymixStateCard(icon:Icons.devices_other_rounded,title:'Oturumlar yüklenemedi',message:error!,actionLabel:'Tekrar dene',onAction:_load)
        else if(rows.isEmpty) const LymixStateCard(icon:Icons.devices_rounded,title:'Aktif oturum bulunamadı',message:'Giriş yaptığın cihazlar burada listelenecek.')
        else ...rows.map((r){final d=r['device'] is Map?Map<String,dynamic>.from(r['device'] as Map):const <String,dynamic>{};final current=r['current']==true;return Container(
          margin:const EdgeInsets.only(bottom:9),padding:const EdgeInsets.all(13),decoration:BoxDecoration(color:LymixColors.surface,borderRadius:BorderRadius.circular(18),border:Border.all(color:Colors.white.withValues(alpha:.05))),
          child:Row(children:[
            Container(width:42,height:42,decoration:BoxDecoration(color:const Color(0x14FFD643),borderRadius:BorderRadius.circular(13)),child:Icon('${d['platform']??''}'.toLowerCase().contains('ios')?Icons.phone_iphone_rounded:Icons.android_rounded,color:LymixColors.gold)),
            const SizedBox(width:10),Expanded(child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[Text('${d['deviceName']??'Cihaz'}',style:const TextStyle(fontWeight:FontWeight.w800,fontSize:11.5)),Text('${d['platform']??''} • ${d['appVersion']??''}${current?' • Bu cihaz':''}',style:const TextStyle(color:Colors.white38,fontSize:9))])),
            if(!current) IconButton(tooltip:'Bu oturumu kapat',onPressed:()=>_revoke('${r['id']??''}'),icon:const Icon(Icons.logout_rounded,color:Colors.white54)) else const Icon(Icons.verified_rounded,color:LymixColors.gold),
          ]));}),
      ],
    )),
  );
}
''')

write('lib/screens/account_security_screen.dart', r'''import 'package:flutter/material.dart';
import '../core/api_client.dart';
import '../services/session_service.dart';
import '../theme/lymix_theme.dart';

class AccountSecurityScreen extends StatefulWidget { const AccountSecurityScreen({super.key}); @override State<AccountSecurityScreen> createState()=>_AccountSecurityScreenState(); }
class _AccountSecurityScreenState extends State<AccountSecurityScreen>{
 final current=TextEditingController(); final next=TextEditingController(); bool busy=false; SessionUser? user;
 ApiClient get api=>const ApiClient(tokenProvider:SessionService.token);
 @override void initState(){super.initState();SessionService.user().then((u){if(mounted)setState(()=>user=u);});}
 @override void dispose(){current.dispose();next.dispose();super.dispose();}
 void msg(String s){if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(s)));}
 Future<void> changePassword()async{if(next.text.length<8){msg('Yeni şifre en az 8 karakter olmalı.');return;}setState(()=>busy=true);try{await api.postJson('/api/v1/auth/password/change',{'currentPassword':current.text,'newPassword':next.text});current.clear();next.clear();msg('Şifre değiştirildi. Diğer oturumlar güvenlik için kapatıldı.');}catch(e){msg('Şifre değiştirilemedi: $e');}finally{if(mounted)setState(()=>busy=false);}}
 @override Widget build(BuildContext context)=>Scaffold(appBar:AppBar(title:const Text('Hesap ve Güvenlik')),body:ListView(padding:const EdgeInsets.all(16),children:[
  _card('Doğrulanmış telefon',Icons.verified_user_rounded,[ListTile(contentPadding:EdgeInsets.zero,leading:const Icon(Icons.phone_android_rounded,color:LymixColors.gold),title:Text(user?.phoneE164??'Telefon bilgisi yüklenemedi'),subtitle:const Text('Telefon kayıt/OTP akışında doğrulanır. Numara değişikliği ayrı güvenlik akışı gerektirir.'))]),
  const SizedBox(height:14),
  _card('Şifre değiştir',Icons.password_rounded,[TextField(controller:current,obscureText:true,decoration:const InputDecoration(labelText:'Mevcut şifre')),const SizedBox(height:10),TextField(controller:next,obscureText:true,decoration:const InputDecoration(labelText:'Yeni şifre (en az 8 karakter)')),const SizedBox(height:10),SizedBox(width:double.infinity,child:FilledButton(onPressed:busy?null:changePassword,child:Text(busy?'Değiştiriliyor...':'Şifreyi değiştir')))]),
 ]));
 Widget _card(String title,IconData icon,List<Widget> children)=>Container(padding:const EdgeInsets.all(16),decoration:BoxDecoration(color:LymixColors.surface,borderRadius:BorderRadius.circular(20),border:Border.all(color:Colors.white10)),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[Row(children:[Icon(icon,color:LymixColors.gold),const SizedBox(width:9),Text(title,style:const TextStyle(fontWeight:FontWeight.w900,fontSize:16))]),const SizedBox(height:14),...children]));
}
''')

write('lib/screens/account_data_screen.dart', r'''import 'dart:convert';
import 'package:flutter/material.dart';
import '../theme/lymix_theme.dart';
import '../core/api_client.dart';
import '../services/session_service.dart';
import 'account_security_screen.dart';
import 'auth_gate.dart';

class AccountDataScreen extends StatefulWidget { const AccountDataScreen({super.key}); @override State<AccountDataScreen> createState()=>_AccountDataScreenState(); }
class _AccountDataScreenState extends State<AccountDataScreen>{
 bool busy=false; ApiClient get api=>const ApiClient(tokenProvider:SessionService.token);
 Future<void> _export() async{if(busy)return;setState(()=>busy=true);try{final data=await api.getJson('/api/v1/me/export');if(!mounted)return;await showDialog<void>(context:context,builder:(ctx)=>AlertDialog(title:const Text('Verilerim'),content:SizedBox(width:double.maxFinite,child:SingleChildScrollView(child:SelectableText(const JsonEncoder.withIndent('  ').convert(data)))),actions:[TextButton(onPressed:()=>Navigator.pop(ctx),child:const Text('Kapat'))]));}catch(e){if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text('Veriler alınamadı: $e')));}finally{if(mounted)setState(()=>busy=false);}}
 Future<void> _deleteRequest() async{
  final password=TextEditingController();
  final confirmed=await showDialog<bool>(context:context,builder:(ctx)=>AlertDialog(title:const Text('Hesabı kalıcı sil'),content:Column(mainAxisSize:MainAxisSize.min,children:[const Text('Bu işlem geri alınamaz. Devam etmek için mevcut şifreni gir.'),const SizedBox(height:12),TextField(controller:password,obscureText:true,decoration:const InputDecoration(labelText:'Mevcut şifre'))]),actions:[TextButton(onPressed:()=>Navigator.pop(ctx,false),child:const Text('Vazgeç')),FilledButton(onPressed:()=>Navigator.pop(ctx,true),child:const Text('Hesabı Sil'))]))??false;
  if(!confirmed){password.dispose();return;} setState(()=>busy=true);
  try{await api.deleteJson('/api/v1/me',{'password':password.text});await SessionService.clear();if(!mounted)return;Navigator.pushAndRemoveUntil(context,MaterialPageRoute(builder:(_)=>const AuthGate()),(_)=>false);}catch(e){if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text('Hesap silinemedi: $e')));}finally{password.dispose();if(mounted)setState(()=>busy=false);}
 }
 @override Widget build(BuildContext context)=>Scaffold(appBar:AppBar(title:const Text('Hesap ve Veriler')),body:ListView(padding:const EdgeInsets.fromLTRB(16,10,16,28),children:[
  _tile(Icons.download_for_offline_outlined,'Verilerimi görüntüle','Profil, cihaz, oturum ve hesap verilerini sunucudan getir.',busy?null:_export),const SizedBox(height:10),
  _tile(Icons.security_rounded,'Hesap güvenliği','Doğrulanmış telefonunu görüntüle ve şifreni değiştir.',()=>Navigator.push(context,MaterialPageRoute(builder:(_)=>const AccountSecurityScreen()))),const SizedBox(height:18),
  Container(padding:const EdgeInsets.all(14),decoration:BoxDecoration(color:const Color(0xFF261218),borderRadius:BorderRadius.circular(18),border:Border.all(color:const Color(0x33FF667A))),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[const Row(children:[Icon(Icons.warning_amber_rounded,color:Color(0xFFFF9AAA)),SizedBox(width:8),Text('Hesap silme',style:TextStyle(fontWeight:FontWeight.w900))]),const SizedBox(height:5),const Text('Silme işlemi mevcut şifre doğrulamasıyla sunucuda yapılır.',style:TextStyle(color:Color(0x75FFFFFF),fontSize:9.5,height:1.4)),const SizedBox(height:10),OutlinedButton.icon(onPressed:busy?null:_deleteRequest,icon:const Icon(Icons.delete_forever_outlined),label:const Text('Hesabımı sil'),style:OutlinedButton.styleFrom(foregroundColor:const Color(0xFFFFA8B6),side:const BorderSide(color:Color(0x44FF667A))))]))
 ]));
 Widget _tile(IconData icon,String title,String sub,VoidCallback? tap)=>ListTile(onTap:tap,tileColor:LymixColors.surface,shape:RoundedRectangleBorder(borderRadius:BorderRadius.circular(18)),leading:Container(width:42,height:42,decoration:BoxDecoration(color:const Color(0x14FFD643),borderRadius:BorderRadius.circular(13)),child:Icon(icon,color:LymixColors.gold)),title:Text(title,style:const TextStyle(fontWeight:FontWeight.w800,fontSize:11.5)),subtitle:Text(sub,style:const TextStyle(color:Colors.white38,fontSize:9.2)),trailing:tap==null?const SizedBox(width:18,height:18,child:CircularProgressIndicator(strokeWidth:2,color:LymixColors.gold)):const Icon(Icons.chevron_right_rounded,color:Colors.white30));
}
''')

write('lib/services/wallet_service.dart', r'''import '../core/api_client.dart';
import '../models/wallet_models.dart';

class WalletService {
  final ApiClient api; const WalletService(this.api);
  Future<WalletBalance> balance() async {final data=Map<String,dynamic>.from(await api.getJson('/api/v1/wallet') as Map);return WalletBalance(coins:int.tryParse('${data['balance']??0}')??0,diamonds:0);}
  Future<List<CoinPackage>> packages() async => const [];
  Future<void> startPurchase(String packageId) async => throw const ApiException('Coin satın alma mağaza ödeme ekranından yapılır.',code:'STORE_PURCHASE_REQUIRED');
  Future<List<Map<String,dynamic>>> transactions() async {final data=await api.getJson('/api/v1/wallet/ledger');return (data as List? ?? const[]).whereType<Map>().map((e)=>Map<String,dynamic>.from(e)).toList();}
  Future<void> adminGrant({required String targetUserId,required int coins,required String reason}) async {await api.postJson('/api/v1/admin/wallet/adjust',{'userId':targetUserId,'idempotencyKey':'admin_mobile_${DateTime.now().microsecondsSinceEpoch}','$direction':'CREDIT','direction':'CREDIT','amount':'$coins','reason':reason});}
}
'''.replace("'$direction':'CREDIT',", ""))

write('lib/screens/wallet_screen.dart', r'''import 'package:flutter/material.dart';
import '../core/api_client.dart';
import '../design/lymix_design_system.dart';
import '../models/wallet_models.dart';
import '../services/wallet_service.dart';
import '../services/session_service.dart';
import 'coin_store_screen.dart';
import 'live_support_screen.dart';

class WalletScreen extends StatefulWidget { const WalletScreen({super.key}); @override State<WalletScreen> createState()=>_WalletScreenState(); }
class _WalletScreenState extends State<WalletScreen>{
 late final WalletService service=WalletService(const ApiClient(tokenProvider:SessionService.token)); WalletBalance balance=const WalletBalance(coins:0,diamonds:0); bool loading=true; String? error;
 @override void initState(){super.initState();load();}
 Future<void> load()async{setState((){loading=true;error=null;});try{final b=await service.balance();if(mounted)setState((){balance=b;loading=false;});}catch(e){if(mounted)setState((){error='$e';loading=false;});}}
 Future<void> transactions()async{showModalBottomSheet<void>(context:context,showDragHandle:true,isScrollControlled:true,builder:(ctx)=>FutureBuilder<List<Map<String,dynamic>>>(future:service.transactions(),builder:(context,s){if(s.connectionState!=ConnectionState.done)return const SizedBox(height:260,child:Center(child:CircularProgressIndicator()));if(s.hasError)return SizedBox(height:260,child:Center(child:Text('İşlemler yüklenemedi: ${s.error}')));final rows=s.data??const[];if(rows.isEmpty)return const SizedBox(height:260,child:Center(child:Text('Henüz cüzdan işlemi yok.')));return SafeArea(child:ConstrainedBox(constraints:BoxConstraints(maxHeight:MediaQuery.sizeOf(context).height*.72),child:ListView.separated(padding:const EdgeInsets.fromLTRB(16,0,16,24),itemCount:rows.length,separatorBuilder:(_,__)=>const Divider(height:1),itemBuilder:(_,i){final r=rows[i];final dir='${r['direction']??''}';final amount='${r['amount']??'0'}';return ListTile(leading:Icon(dir=='DEBIT'?Icons.remove_circle_outline:Icons.add_circle_outline,color:dir=='DEBIT'?LymixPalette.danger:LymixPalette.success),title:Text('${dir=='DEBIT'?'-':'+'}$amount Coin',style:const TextStyle(fontWeight:FontWeight.w800)),subtitle:Text('${r['source']??'İşlem'}\n${r['createdAt']??''}'),isThreeLine:true);}))));}));}
 @override Widget build(BuildContext context)=>Scaffold(appBar:AppBar(title:const Text('Cüzdanım'),actions:[IconButton(tooltip:'Canlı destek',onPressed:()=>Navigator.push(context,MaterialPageRoute(builder:(_)=>const LiveSupportScreen())),icon:const Icon(Icons.support_agent_rounded)),IconButton(tooltip:'İşlemler',onPressed:transactions,icon:const Icon(Icons.receipt_long_rounded))]),body:RefreshIndicator(onRefresh:load,child:ListView(physics:const AlwaysScrollableScrollPhysics(),padding:const EdgeInsets.fromLTRB(16,16,16,28),children:[
  if(loading)const SizedBox(height:220,child:Center(child:CircularProgressIndicator(color:LymixPalette.gold))) else if(error!=null)Container(padding:const EdgeInsets.all(18),decoration:BoxDecoration(color:LymixPalette.surface,borderRadius:BorderRadius.circular(18)),child:Column(children:[Text('Cüzdan yüklenemedi: $error',textAlign:TextAlign.center),const SizedBox(height:10),FilledButton(onPressed:load,child:const Text('Tekrar Dene'))])) else ...[
   const Text('Bakiye',style:TextStyle(color:LymixPalette.text3,fontSize:10)),const SizedBox(height:5),Row(children:[const Icon(Icons.monetization_on_rounded,color:LymixPalette.gold,size:38),const SizedBox(width:8),Text('${balance.coins}',style:const TextStyle(fontSize:34,fontWeight:FontWeight.w900))]),const SizedBox(height:20),
   SizedBox(height:54,child:FilledButton.icon(onPressed:()=>Navigator.push(context,MaterialPageRoute(builder:(_)=>const CoinStoreScreen())).then((_)=>load()),icon:const Icon(Icons.add_card_rounded),label:const Text('Coin Yükle'))),const SizedBox(height:10),
   SizedBox(height:50,child:OutlinedButton.icon(onPressed:transactions,icon:const Icon(Icons.receipt_long_rounded),label:const Text('Coin Hareketleri'))),const SizedBox(height:18),
   Container(padding:const EdgeInsets.all(12),decoration:BoxDecoration(color:Colors.white.withValues(alpha:.035),borderRadius:BorderRadius.circular(16),border:Border.all(color:Colors.white.withValues(alpha:.055))),child:const Text('Coin satın alma Android’de Google Play, iPhone’da App Store ödeme ekranından yapılır. Kart bilgileri Lymix sunucusuna gönderilmez.',style:TextStyle(color:LymixPalette.text3,fontSize:9,height:1.45))),
  ]
 ])));
}
''')

# Admin coin grant must send the authenticated SUPER_ADMIN token.
p = root / 'lib/screens/admin_coin_grant_screen.dart'
s = p.read_text()
if "../services/session_service.dart" not in s:
    s = s.replace("import '../services/wallet_service.dart';\n", "import '../services/wallet_service.dart';\nimport '../services/session_service.dart';\n")
s = s.replace("WalletService(const ApiClient()).adminGrant(", "WalletService(const ApiClient(tokenProvider:SessionService.token)).adminGrant(")
p.write_text(s)

# Secondary feature hub: Kendi Odam should also enter the one stable room.
p = root / 'lib/screens/feature_center_screen.dart'
s = p.read_text()
if "../services/permanent_room_service.dart" not in s:
    s = s.replace("import 'package:flutter/material.dart';\n", "import 'package:flutter/material.dart';\nimport '../services/permanent_room_service.dart';\n")
if "import 'room_screen.dart';" not in s:
    s = s.replace("import 'room_create_screen.dart';\n", "import 'room_create_screen.dart';\nimport 'room_screen.dart';\n")
s = s.replace("            _route(context, Icons.home_work_outlined, 'Kendi Odam', 'Hesabına bağlı tek kalıcı oda', const RoomCreateScreen()),", "            Card(margin:const EdgeInsets.only(bottom:10),child:ListTile(leading:const CircleAvatar(child:Icon(Icons.home_work_outlined)),title:const Text('Kendi Odam',style:TextStyle(fontWeight:FontWeight.w800)),subtitle:const Text('Hesabına bağlı tek kalıcı oda',style:TextStyle(fontSize:11)),trailing:const Icon(Icons.chevron_right_rounded),onTap:() async{final room=await PermanentRoomService.ensureForCurrentUser();if(!context.mounted)return;Navigator.push(context,MaterialPageRoute(builder:(_)=>LymixRoomScreen(roomId:room.roomId,roomTitle:room.title,isPrivateRoom:room.isPrivate,currentUserIsOwner:true)));})),")
p.write_text(s)

# Inactive legacy home still participates in analyzer/dead-callback checks.
p = root / 'lib/screens/home_screen.dart'
s = p.read_text()
s = s.replace("_smallAction('Mesaj', Icons.chat_bubble_outline, () {}),", "_smallAction('Mesaj',Icons.chat_bubble_outline,()=>Navigator.push(context,MaterialPageRoute(builder:(_)=>const GlobalSearchScreen()))),")
p.write_text(s)

print('PRODUCTION_API_CONTRACT_FIXES_APPLIED')
