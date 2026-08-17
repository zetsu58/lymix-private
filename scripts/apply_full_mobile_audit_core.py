from pathlib import Path
import re, sys
root=Path(sys.argv[1]) if len(sys.argv)>1 else Path('.')

def rw(rel,fn):
 p=root/rel; s=p.read_text(); n=fn(s); p.write_text(n); print(('PATCHED' if n!=s else 'NO_CHANGE'),rel)

def room(s):
 s=s.replace("          contribution: occupied ? '0' : '0',\n","          contribution: '',\n")
 s=s.replace("          onTap: () => occupied ? _showSeatUserProfile(i) : _showSeatActions(i),\n","          onTap: () => _seatTap(i),\n          onLongPress: (currentUserIsRoomOwner || currentUserIsRoomAdmin) ? () => _showAdminSeatMenu(i) : null,\n")
 s=s.replace("    // Oda sahibi veya admin koltuğa dokunduğunda yönetim menüsü açılır.\n    if (currentUserIsRoomOwner || currentUserIsRoomAdmin) {\n      _showAdminSeatMenu(i);\n      return;\n    }\n\n","")
 old="""  void _sitOnSeat(int i) {\n    if (seats[i].status != SeatStatus.empty || mySeat != -1) return;\n    setState(() {\n      mySeat = i;\n      seats[i] = RoomSeat(index:i,status:SeatStatus.occupied,userId:'me',userName:'Siz',avatarUrl:null);\n    });\n    _playVipEntrance('Siz',3);\n  }\n"""
 new="""  Future<void> _sitOnSeat(int i) async {\n    if (seats[i].status != SeatStatus.empty || mySeat != -1) return;\n    final current = await SessionService.user();\n    if (!mounted) return;\n    final displayName = current == null ? 'Siz' : (current.displayName.isEmpty ? current.login : current.displayName);\n    setState(() {\n      mySeat = i;\n      seats[i] = RoomSeat(index:i,status:SeatStatus.occupied,userId:current?.id ?? 'me',userName:displayName,avatarUrl:current?.avatarUrl);\n    });\n    _playVipEntrance(displayName,current?.level ?? 1);\n  }\n"""
 s=s.replace(old,new)
 old="""  void _openRoomSettings() {\n    Navigator.push(\n      context,\n      MaterialPageRoute(\n        builder: (_) => RoomSettingsScreen(\n          info: _roomInfo,\n          onMembers: _openMembers,\n          onAdmins: _openMembers,\n        ),\n      ),\n    );\n  }\n"""
 new="""  Future<void> _openRoomSettings() async {\n    final action = await Navigator.push<String>(context,MaterialPageRoute(builder:(_)=>RoomSettingsScreen(info:_roomInfo,onMembers:_openMembers,onAdmins:_openMembers)));\n    if(!mounted||action==null)return;\n    switch(action){\n      case 'pk': _openPkPanel(); break;\n      case 'game': Navigator.push(context,MaterialPageRoute(builder:(_)=>GameCenterScreen(roomId:widget.roomId))); break;\n      case 'seat': _info('Koltuk yönetimi','Tek dokunuş otur/kalk içindir. Yönetim için koltuğa uzun bas.'); break;\n      case 'clear_chat': setState((){messages.clear();messages.add({'u':'Sistem','m':'🧹 Sohbet akışı temizlendi.'});}); break;\n      case 'room': case 'background': case 'effects': case 'mic': _roomSettings(); break;\n      default: _info('Oda Ayarları','Bu ayar mevcut oda yönetim akışından yönetiliyor.');\n    }\n  }\n"""
 s=s.replace(old,new)
 s=s.replace("        privateRoom:widget.isPrivateRoom,\n","        privateRoom:widget.isPrivateRoom,\n        avatarUrl:s.avatarUrl,\n",1)
 return s
rw('lib/screens/room_screen.dart',room)

def seat(s):
 a=s.index('class LymixSeatPedestal extends StatefulWidget'); b=s.index('class LymixProfileHero extends StatelessWidget',a)
 x="""class LymixSeatPedestal extends StatefulWidget {\n  final Widget avatar; final String label; final String contribution; final LymixSeatVisualState state; final VoidCallback? onTap; final VoidCallback? onLongPress;\n  const LymixSeatPedestal({super.key,required this.avatar,required this.label,required this.contribution,required this.state,this.onTap,this.onLongPress});\n  @override State<LymixSeatPedestal> createState()=>_LymixSeatPedestalState();\n}\nclass _LymixSeatPedestalState extends State<LymixSeatPedestal> with SingleTickerProviderStateMixin {\n  late final AnimationController c;\n  @override void initState(){super.initState();c=AnimationController(vsync:this,duration:const Duration(milliseconds:2400))..repeat();}\n  @override void dispose(){c.dispose();super.dispose();}\n  Color get accent=>switch(widget.state){LymixSeatVisualState.speaking=>LymixPalette.success,LymixSeatVisualState.host=>LymixPalette.gold,LymixSeatVisualState.vip=>LymixPalette.pink,LymixSeatVisualState.locked=>LymixPalette.gold,LymixSeatVisualState.muted=>LymixPalette.danger,_=>LymixPalette.purple};\n  @override Widget build(BuildContext context){final animate=widget.state==LymixSeatVisualState.speaking;return GestureDetector(behavior:HitTestBehavior.opaque,onTap:widget.onTap,onLongPress:widget.onLongPress,child:Column(mainAxisSize:MainAxisSize.min,children:[AnimatedBuilder(animation:c,child:ClipOval(child:widget.avatar),builder:(_,child)=>Stack(alignment:Alignment.center,clipBehavior:Clip.none,children:[if(animate)Transform.rotate(angle:c.value*math.pi*2,child:Container(width:68,height:68,decoration:BoxDecoration(shape:BoxShape.circle,gradient:SweepGradient(colors:[Colors.transparent,accent,LymixPalette.cyan,Colors.transparent])))),Container(width:62,height:62,padding:const EdgeInsets.all(2.5),decoration:BoxDecoration(shape:BoxShape.circle,color:const Color(0xFF110B19),border:Border.all(color:accent.withValues(alpha:animate?.95:.38),width:animate?2:1),boxShadow:[BoxShadow(color:accent.withValues(alpha:animate?.22:.08),blurRadius:animate?18:8)]),child:child),if(widget.state==LymixSeatVisualState.locked)const Icon(Icons.lock_rounded,color:LymixPalette.gold,size:18),if(widget.state==LymixSeatVisualState.muted)const Positioned(right:1,bottom:4,child:CircleAvatar(radius:8,backgroundColor:Color(0xFF160D1C),child:Icon(Icons.mic_off_rounded,size:9,color:LymixPalette.danger)))])),const SizedBox(height:7),SizedBox(width:74,child:Text(widget.label,textAlign:TextAlign.center,maxLines:1,overflow:TextOverflow.ellipsis,style:const TextStyle(color:LymixPalette.text2,fontSize:8.8,fontWeight:FontWeight.w800)))]));}\n}\n\n"""
 return s[:a]+x+s[b:]
rw('lib/widgets/lymix_visual_production.dart',seat)

def session(s):
 a=s.index('class SessionUser {'); b=s.index('class SessionService {',a)
 x="""class SessionUser {\n  final String id,login,displayName,role; final int level; final List<String> badges; final String? phoneE164,avatarUrl;\n  const SessionUser({required this.id,required this.login,required this.displayName,required this.role,required this.level,required this.badges,this.phoneE164,this.avatarUrl});\n  factory SessionUser.fromJson(Map<String,dynamic> json){final p=json['profile'] is Map?Map<String,dynamic>.from(json['profile'] as Map):const <String,dynamic>{};return SessionUser(id:'${json['id']??''}',login:'${json['username']??json['login']??''}',displayName:'${p['displayName']??json['displayName']??json['name']??''}',role:'${json['role']??'USER'}',level:(p['level'] as num?)?.toInt()??(json['level'] as num?)?.toInt()??1,badges:(p['badges'] as List? ?? json['badges'] as List? ?? const []).map((e)=>'$e').toList(),phoneE164:json['phoneE164']?.toString(),avatarUrl:(p['avatarUrl']??p['avatar']??json['avatarUrl']??json['avatar'])?.toString());}\n  Map<String,dynamic> toJson()=>{'id':id,'login':login,'displayName':displayName,'role':role,'level':level,'badges':badges,'phoneE164':phoneE164,'avatarUrl':avatarUrl};\n}\n\n"""
 return s[:a]+x+s[b:]
rw('lib/services/session_service.dart',session)

def home(s):
 if 'permanent_room_service.dart' not in s:s=s.replace("import 'creator_verification_screen.dart';\n","import 'creator_verification_screen.dart';\nimport '../services/permanent_room_service.dart';\nimport 'wallet_screen.dart';\n")
 s=s.replace("_sectionTitle('Sana Özel Odalar', 'Tümünü Gör')","_sectionTitle('Sana Özel Odalar','Tümünü Gör',()=>setState(()=>tab=2))")
 s=s.replace("_sectionTitle('Anlar', 'Daha Fazla')","_sectionTitle('Anlar','Daha Fazla',()=>Navigator.push(context,MaterialPageRoute(builder:(_)=>const FeedScreen())))")
 s=s.replace("_sectionTitle('Akıllı Eşleşmeler', 'Yenile')","_sectionTitle('Akıllı Eşleşmeler','Keşfet',()=>setState(()=>tab=1))")
 s=s.replace("Widget _sectionTitle(String title, String action) => Padding(","Widget _sectionTitle(String title,String action,VoidCallback onAction)=>Padding(")
 s=s.replace("      Text(action, style: const TextStyle(color: LymixColors.gold, fontSize: 12, fontWeight: FontWeight.w700)),","      TextButton(onPressed:onAction,child:Text(action,style:const TextStyle(color:LymixColors.gold,fontSize:12,fontWeight:FontWeight.w700))),")
 s=s.replace("child: const TextField(style: TextStyle(color: Colors.white), decoration: InputDecoration(icon: Icon(Icons.search, color: Colors.white54), hintText: 'İsim, kullanıcı adı veya ilgi alanı ara', hintStyle: TextStyle(color: Colors.white38), border: InputBorder.none))","child: TextField(readOnly:true,onTap:()=>Navigator.push(context,MaterialPageRoute(builder:(_)=>const GlobalSearchScreen())),style:const TextStyle(color:Colors.white),decoration:const InputDecoration(icon:Icon(Icons.search,color:Colors.white54),hintText:'İsim, kullanıcı adı veya ilgi alanı ara',hintStyle:TextStyle(color:Colors.white38),border:InputBorder.none))")
 s=s.replace("_featureStrip('🎙️', 'Sesli Parti', 'Binlerce konu odası arasından seç', () {})","_featureStrip('🎙️','Sesli Parti','Sesli odaları ara veya kendi odana gir',()=>Navigator.push(context,MaterialPageRoute(builder:(_)=>const GlobalSearchScreen())))")
 s=s.replace("_featureStrip('⚔️', 'PK Savaşı', 'Takımını kur, puan topla, liderlik tablosuna çık', () {})","_featureStrip('⚔️','PK Savaşı','Kendi odana gir ve PK panelini aç',_openMyRoom)")
 s=s.replace("_featureStrip('🎲', 'Mini Oyunlar', 'Ludo ve oda içi oyunlarla sohbeti hareketlendir', () {})","_featureStrip('🎲','Mini Oyunlar','Oyun merkezini aç',()=>Navigator.push(context,MaterialPageRoute(builder:(_)=>const GameCenterScreen())))")
 s=s.replace("_profileRow(Icons.home_work_outlined, 'Kendi Odam', 'Hesabına bağlı kalıcı oda', () => Navigator.push(context, MaterialPageRoute(builder: (_) => const RoomCreateScreen())))","_profileRow(Icons.home_work_outlined,'Kendi Odam','Hesabına bağlı kalıcı odaya doğrudan gir',_openMyRoom)")
 a=s.find('  void _showWallet() => showModalBottomSheet('); b=s.find('\n  Widget _balance',a)
 if a!=-1 and b!=-1:s=s[:a]+"  void _showWallet()=>Navigator.push(context,MaterialPageRoute(builder:(_)=>const WalletScreen()));\n\n"+s[b:]
 s=s.replace("              const CircleAvatar(radius: 38, backgroundColor: Color(0xFF2A1840), child: Icon(Icons.person_rounded, size: 34, color: Colors.white70)),","              CircleAvatar(radius:38,backgroundColor:const Color(0xFF2A1840),backgroundImage:(user?.avatarUrl?.isNotEmpty??false)?NetworkImage(user!.avatarUrl!):null,child:(user?.avatarUrl?.isNotEmpty??false)?null:const Icon(Icons.person_rounded,size:34,color:Colors.white70)),")
 mark="  void _showVip() => Navigator.push(context, MaterialPageRoute(builder: (_) => const VipCenterScreen()));"
 if mark in s and '_openMyRoom() async' not in s:s=s.replace(mark,"  Future<void> _openMyRoom() async {try{final r=await PermanentRoomService.ensureForCurrentUser();if(!mounted)return;await Navigator.push(context,MaterialPageRoute(builder:(_)=>LymixRoomScreen(roomId:r.roomId,roomTitle:r.title)));}catch(e){if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text('Oda açılamadı: $e')));}}\n\n"+mark)
 return s
rw('lib/screens/home_screen.dart',home)

def settings(s):
 m={"(){}),":"()=>Navigator.pop(context,'room')),"}
 reps={
"_tile(Icons.image_rounded,'Kapak','Oda kapak görselini düzenle',(){})":"_tile(Icons.image_rounded,'Kapak','Oda kapak görselini düzenle',()=>Navigator.pop(context,'room'))",
"_tile(Icons.sell_rounded,'Yayın odası etiketi',info.category,(){})":"_tile(Icons.sell_rounded,'Yayın odası etiketi',info.category,()=>Navigator.pop(context,'room'))",
"_tile(Icons.campaign_rounded,'Duyuru',info.announcement.isEmpty?'Henüz duyuru yok':info.announcement,(){})":"_tile(Icons.campaign_rounded,'Duyuru',info.announcement.isEmpty?'Henüz duyuru yok':info.announcement,()=>Navigator.pop(context,'room'))",
"_tile(Icons.photo_library_rounded,'Duyuru resmi','Oda içi duyuru görseli',(){})":"_tile(Icons.photo_library_rounded,'Duyuru resmi','Oda içi duyuru görseli',()=>Navigator.pop(context,'room'))",
"_tile(Icons.event_seat_rounded,'Koltuk yönetimi','Kilit, davet ve mikrofon izinleri',(){})":"_tile(Icons.event_seat_rounded,'Koltuk yönetimi','Kilit, davet ve mikrofon izinleri',()=>Navigator.pop(context,'seat'))",
"_tile(Icons.mic_rounded,'Mic modu','Koltuk mikrofon davranışını ayarla',(){})":"_tile(Icons.mic_rounded,'Mic modu','Koltuk mikrofon davranışını ayarla',()=>Navigator.pop(context,'mic'))",
"_tile(Icons.music_note_rounded,'Müzik','Oda içi müzik kontrolleri',(){})":"_tile(Icons.music_note_rounded,'Müzik','Oda içi müzik kontrolleri',()=>Navigator.pop(context,'room'))",
"_tile(Icons.graphic_eq_rounded,'Ses efekti','Ses efektleri',(){})":"_tile(Icons.graphic_eq_rounded,'Ses efekti','Ses efektleri',()=>Navigator.pop(context,'effects'))",
"_tile(Icons.wallpaper_rounded,'Arkaplan','Oda arka planı ve tema',(){})":"_tile(Icons.wallpaper_rounded,'Arkaplan','Oda arka planı ve tema',()=>Navigator.pop(context,'background'))",
"_tile(Icons.lock_rounded,'Oda kilidi','Şifreli / kapalı oda ayarları',(){})":"_tile(Icons.lock_rounded,'Oda kilidi','Şifreli / kapalı oda ayarları',()=>Navigator.pop(context,'room'))",
"_tile(Icons.person_remove_rounded,'Engellenenler','Odaya giriş engeli verilen kullanıcılar',(){})":"_tile(Icons.person_remove_rounded,'Engellenenler','Odaya giriş engeli verilen kullanıcılar',onMembers)",
"_tile(Icons.cleaning_services_rounded,'Metni temizle','Sohbet akışını temizle',(){})":"_tile(Icons.cleaning_services_rounded,'Metni temizle','Sohbet akışını temizle',()=>Navigator.pop(context,'clear_chat'))",
"_tile(Icons.flash_on_rounded,'PK ayarları','Süre, reset ve koltuk davranışı',(){})":"_tile(Icons.flash_on_rounded,'PK ayarları','Süre, reset ve koltuk davranışı',()=>Navigator.pop(context,'pk'))",
"_tile(Icons.sports_esports_rounded,'Oyun merkezi','Oda içi mini oyunlar',(){})":"_tile(Icons.sports_esports_rounded,'Oyun merkezi','Oda içi mini oyunlar',()=>Navigator.pop(context,'game'))"}
 for a,b in reps.items():s=s.replace(a,b)
 return s
rw('lib/screens/room_settings_screen.dart',settings)

def profile(s):
 s=s.replace('  final bool privateRoom;\n','  final bool privateRoom;\n  final String? avatarUrl;\n').replace('    this.privateRoom = false,\n','    this.privateRoom = false,\n    this.avatarUrl,\n')
 s=s.replace('                      backgroundColor: LymixPalette.surface2,\n                      child: Text(','                      backgroundColor: LymixPalette.surface2,\n                      backgroundImage:(widget.avatarUrl?.isNotEmpty??false)?NetworkImage(widget.avatarUrl!):null,\n                      child:(widget.avatarUrl?.isNotEmpty??false)?null:Text(')
 return s
rw('lib/screens/user_profile_screen.dart',profile)

def search(s):return s.replace("          privateRoom:u['privateRoom']==true,\n","          privateRoom:u['privateRoom']==true,\n          avatarUrl:(u['avatarUrl']??u['avatar'])?.toString(),\n")
rw('lib/screens/global_search_screen.dart',search)
print('FULL_MOBILE_AUDIT_FIXES_APPLIED')
