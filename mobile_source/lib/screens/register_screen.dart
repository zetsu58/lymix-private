import 'package:flutter/material.dart';
import '../core/api_client.dart';
import '../services/auth_service.dart';
import '../services/device_identity_service.dart';

class RegisterScreen extends StatefulWidget { final VoidCallback onAuthenticated; const RegisterScreen({super.key,required this.onAuthenticated}); @override State<RegisterScreen> createState()=>_RegisterScreenState(); }
class _RegisterScreenState extends State<RegisterScreen>{
  final phone=TextEditingController(text:'+90'), login=TextEditingController(), displayName=TextEditingController(), password=TextEditingController(), otp=TextEditingController();
  bool busy=false,hide=true,otpSent=false; String? error;
  @override void dispose(){phone.dispose();login.dispose();displayName.dispose();password.dispose();otp.dispose();super.dispose();}
  Future<void> requestOtp() async { if(!phone.text.trim().startsWith('+')||phone.text.trim().length<10){setState(()=>error='Telefon numarasını +90... biçiminde gir.');return;} setState((){busy=true;error=null;}); try{await AuthService(const ApiClient()).requestOtp(phoneE164:phone.text,purpose:'REGISTER');if(mounted)setState(()=>otpSent=true);}on ApiException catch(e){if(mounted)setState(()=>error=e.message);}finally{if(mounted)setState(()=>busy=false);} }
  Future<void> register() async { if(!otpSent||otp.text.trim().length<4||login.text.trim().length<3||displayName.text.trim().length<2||password.text.length<8){setState(()=>error='OTP, kullanıcı adı, görünen ad ve en az 8 karakter şifre gerekli.');return;} setState((){busy=true;error=null;}); try{final deviceId=await DeviceIdentityService.getOrCreate();await AuthService(const ApiClient()).register(phoneE164:phone.text,otpCode:otp.text,login:login.text,displayName:displayName.text,password:password.text,deviceId:deviceId);if(mounted)widget.onAuthenticated();}on ApiException catch(e){if(mounted)setState(()=>error=e.message);}catch(_){if(mounted)setState(()=>error='Hesap oluşturulamadı.');}finally{if(mounted)setState(()=>busy=false);} }
  @override Widget build(BuildContext context)=>Scaffold(appBar:AppBar(title:const Text('Hesap Oluştur')),body:SafeArea(child:ListView(padding:const EdgeInsets.all(20),children:[
    TextField(controller:phone,enabled:!busy,keyboardType:TextInputType.phone,decoration:const InputDecoration(labelText:'Telefon (+90...)',prefixIcon:Icon(Icons.phone_rounded))),const SizedBox(height:10),
    Row(children:[Expanded(child:TextField(controller:otp,enabled:!busy&&otpSent,keyboardType:TextInputType.number,decoration:const InputDecoration(labelText:'SMS kodu',prefixIcon:Icon(Icons.password_rounded)))),const SizedBox(width:8),FilledButton(onPressed:busy?null:requestOtp,child:Text(otpSent?'Tekrar Gönder':'Kod Gönder'))]),const SizedBox(height:10),
    TextField(controller:login,enabled:!busy,autocorrect:false,decoration:const InputDecoration(labelText:'Kullanıcı adı',prefixIcon:Icon(Icons.alternate_email_rounded))),const SizedBox(height:10),
    TextField(controller:displayName,enabled:!busy,decoration:const InputDecoration(labelText:'Görünen ad',prefixIcon:Icon(Icons.badge_outlined))),const SizedBox(height:10),
    TextField(controller:password,enabled:!busy,obscureText:hide,decoration:InputDecoration(labelText:'Şifre',prefixIcon:const Icon(Icons.lock_outline_rounded),suffixIcon:IconButton(onPressed:()=>setState(()=>hide=!hide),icon:Icon(hide?Icons.visibility_outlined:Icons.visibility_off_outlined)))),const SizedBox(height:16),
    SizedBox(height:52,child:FilledButton(onPressed:busy?null:register,child:busy?const CircularProgressIndicator(strokeWidth:2):const Text('Hesap Oluştur',style:TextStyle(fontWeight:FontWeight.w800)))),if(error!=null)...[const SizedBox(height:12),Text(error!,textAlign:TextAlign.center,style:const TextStyle(color:Color(0xFFFF91A2),fontSize:12))],
  ])));
}
