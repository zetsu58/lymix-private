from pathlib import Path
import re, sys

root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('.')

launch = root / 'lib/screens/lymix_launch_screen.dart'
launch.parent.mkdir(parents=True, exist_ok=True)
launch.write_text(r'''import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'auth_gate.dart';

class LymixLaunchScreen extends StatefulWidget {
  const LymixLaunchScreen({super.key});
  @override State<LymixLaunchScreen> createState() => _LymixLaunchScreenState();
}

class _LymixLaunchScreenState extends State<LymixLaunchScreen> with TickerProviderStateMixin {
  late final AnimationController _intro = AnimationController(vsync: this, duration: const Duration(milliseconds: 3200))..forward();
  late final AnimationController _pulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 1800))..repeat(reverse: true);
  @override void initState(){super.initState();_intro.addStatusListener((s){if(s==AnimationStatus.completed&&mounted){Navigator.of(context).pushReplacement(MaterialPageRoute(builder:(_)=>const AuthGate()));}});}
  @override void dispose(){_intro.dispose();_pulse.dispose();super.dispose();}
  @override Widget build(BuildContext context)=>Scaffold(backgroundColor:const Color(0xFF08060D),body:AnimatedBuilder(animation:Listenable.merge([_intro,_pulse]),builder:(context,_){final t=Curves.easeOutCubic.transform(_intro.value);final glow=.45+_pulse.value*.35;return Stack(children:[
    Positioned.fill(child:DecoratedBox(decoration:BoxDecoration(gradient:RadialGradient(center:Alignment(-.15+.3*math.sin(_intro.value*math.pi),-.2),radius:1.15,colors:[Color.fromRGBO(255,214,67,.12+glow*.08),const Color(0xFF171020),const Color(0xFF08060D)])))),
    Positioned(top:-80+50*t,right:-65,child:Transform.rotate(angle:-.25,child:Container(width:260,height:260,decoration:BoxDecoration(borderRadius:BorderRadius.circular(90),gradient:LinearGradient(colors:[Color.fromRGBO(255,214,67,.30*glow),Color.fromRGBO(140,64,255,.12*glow)]))))),
    Positioned(bottom:-110+70*t,left:-90,child:Container(width:300,height:300,decoration:BoxDecoration(shape:BoxShape.circle,border:Border.all(color:Color.fromRGBO(255,214,67,.18*glow),width:2)))),
    Center(child:Transform.scale(scale:.84+.16*t,child:Opacity(opacity:t.clamp(0,1),child:Column(mainAxisSize:MainAxisSize.min,children:[Container(width:104,height:104,decoration:BoxDecoration(borderRadius:BorderRadius.circular(32),gradient:const LinearGradient(colors:[Color(0xFFFFD643),Color(0xFFFFA11A)]),boxShadow:[BoxShadow(color:Color.fromRGBO(255,214,67,.32*glow),blurRadius:42,spreadRadius:8)]),child:const Center(child:Text('L',style:TextStyle(color:Color(0xFF17110A),fontSize:58,fontWeight:FontWeight.w900,letterSpacing:-4)))),const SizedBox(height:18),const Text('LYMIX',style:TextStyle(fontSize:29,fontWeight:FontWeight.w900,letterSpacing:7)),const SizedBox(height:7),Text('Sesinle Bağlan, Dünyanı Paylaş',style:TextStyle(fontSize:11,color:Colors.white.withValues(alpha:.66),letterSpacing:.7))])))),
    Positioned(left:42,right:42,bottom:48,child:Column(children:[ClipRRect(borderRadius:BorderRadius.circular(10),child:LinearProgressIndicator(value:_intro.value,minHeight:3,backgroundColor:Colors.white.withValues(alpha:.07))),const SizedBox(height:10),Text('LYMIX EXPERIENCE',style:TextStyle(fontSize:8.5,letterSpacing:2.4,color:Colors.white.withValues(alpha:.38)))])),
  ]);}));
}
''')

main = root / 'lib/main.dart'
s = main.read_text()
if "screens/lymix_launch_screen.dart" not in s:
    if "screens/auth_gate.dart" in s:
        s = re.sub(r"(import\s+['\"][^'\"]*screens/auth_gate\.dart['\"];\n)", r"\1import 'screens/lymix_launch_screen.dart';\n", s, count=1)
    else:
        s = s.replace("import 'package:flutter/material.dart';\n", "import 'package:flutter/material.dart';\nimport 'screens/lymix_launch_screen.dart';\n")
# Replace the first simple MaterialApp home widget (AuthGate or an older splash) with the new launch root.
s, n = re.subn(r"home\s*:\s*const\s+[A-Za-z_][A-Za-z0-9_]*\s*\(\s*\)\s*,", "home: const LymixLaunchScreen(),", s, count=1)
if n == 0:
    s, n = re.subn(r"home\s*:\s*[A-Za-z_][A-Za-z0-9_]*\s*\(\s*\)\s*,", "home: const LymixLaunchScreen(),", s, count=1)
if 'home: const LymixLaunchScreen(),' not in s:
    raise SystemExit('LYMIX_LAUNCH_ROOT_NOT_WIRED')
main.write_text(s)

showcase = root / 'lib/lymix_pro_showcase.dart'
if showcase.exists():
    s = showcase.read_text()
    # Own profile is already the profile page: no redundant second profile push.
    s = s.replace('onTap: _openSelfProfile,', 'onTap: null,')
    marker = "style: const TextStyle(color: LymixPalette.text3, fontSize: 10),\n                          ),\n                          const SizedBox(height: 9),"
    insert = "style: const TextStyle(color: LymixPalette.text3, fontSize: 10),\n                          ),\n                          const SizedBox(height: 4),\n                          Text('ID: ${u?.id ?? '-'}', style: const TextStyle(color: LymixPalette.gold, fontSize: 9.5, fontWeight: FontWeight.w800, letterSpacing: .25)),\n                          const SizedBox(height: 9),"
    if marker in s and "Text('ID: ${u?.id" not in s:
        s = s.replace(marker, insert, 1)
    s = s.replace("FilledButton.icon(onPressed:()=>Navigator.push(context,MaterialPageRoute(builder:(_)=>const RoomCreateScreen())),icon:const Icon(Icons.mic_rounded),label:const Text('Odama Git'))", "FilledButton.icon(onPressed:()=>_openCurrentUsersPermanentRoom(context),icon:const Icon(Icons.mic_rounded),label:const Text('Odama Git'))")
    showcase.write_text(s)

create = root / 'lib/screens/room_create_screen.dart'
if create.exists():
    s = create.read_text()
    pat = re.compile(r"Navigator\.push\(\s*context\s*,\s*MaterialPageRoute\(\s*builder\s*:\s*\([^)]*\)\s*=>\s*LymixRoomScreen\(", re.S)
    s = pat.sub(lambda m: m.group(0).replace('Navigator.push(', 'Navigator.pushReplacement(', 1), s)
    create.write_text(s)

if showcase.exists():
    s = showcase.read_text()
    if '_openCurrentUsersPermanentRoom' not in s: raise SystemExit('PERMANENT_ROOM_DIRECT_FLOW_MISSING')
    if "ID: ${u?.id" not in s: raise SystemExit('PROFILE_ID_NOT_VISIBLE')
    if 'onTap: _openSelfProfile,' in s: raise SystemExit('REDUNDANT_SELF_PROFILE_NAVIGATION_STILL_PRESENT')

print('REFERENCE_VIDEO_UX_FIXES_APPLIED')
