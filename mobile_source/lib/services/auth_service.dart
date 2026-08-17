import '../core/api_client.dart';
import 'session_service.dart';

class AuthService {
  final ApiClient api;
  const AuthService(this.api);

  Future<void> requestOtp({required String phoneE164, String purpose='REGISTER'}) async {
    await api.postJson('/api/v1/auth/otp/request', {'phoneE164':phoneE164.trim(),'purpose':purpose});
  }

  Future<SessionUser> login({required String login,required String password,required String deviceId,String platform='android',String appVersion='21.22.0'}) async {
    final data=await api.postJson('/api/v1/auth/login',{'login':login.trim(),'password':password,'deviceKey':deviceId,'deviceName':'LYMIX Android','platform':platform,'appVersion':appVersion});
    return _persist(data);
  }

  Future<SessionUser> loginWithOtp({required String phoneE164,required String otpCode,required String deviceId,String platform='android',String appVersion='21.22.0'}) async {
    final data=await api.postJson('/api/v1/auth/login/otp',{'phoneE164':phoneE164.trim(),'otpCode':otpCode.trim(),'deviceKey':deviceId,'deviceName':'LYMIX Android','platform':platform,'appVersion':appVersion});
    return _persist(data);
  }

  Future<SessionUser> register({required String phoneE164,required String otpCode,required String login,required String displayName,required String password,required String deviceId,String platform='android',String appVersion='21.22.0'}) async {
    final data=await api.postJson('/api/v1/auth/register',{'phoneE164':phoneE164.trim(),'otpCode':otpCode.trim(),'username':login.trim(),'displayName':displayName.trim(),'password':password,'deviceKey':deviceId,'deviceName':'LYMIX Android','platform':platform,'appVersion':appVersion});
    return _persist(data);
  }

  Future<bool> refresh() async {
    final refreshToken=await SessionService.refreshToken(); if(refreshToken==null||refreshToken.isEmpty)return false;
    try { final data=Map<String,dynamic>.from(await api.postJson('/api/v1/auth/refresh',{'refreshToken':refreshToken}) as Map); final user=SessionUser.fromJson(Map<String,dynamic>.from(data['user'] as Map)); await SessionService.updateTokens(accessToken:'${data['accessToken']}',refreshToken:'${data['refreshToken']}',sessionId:data['sessionId']?.toString(),user:user); return true; }
    catch(_){await SessionService.clear();return false;}
  }

  Future<void> logout() async { try { await ApiClient(tokenProvider:SessionService.token).postJson('/api/v1/auth/logout',{}); } catch(_) {} finally { await SessionService.clear(); } }

  Future<SessionUser> _persist(dynamic data) async { final map=Map<String,dynamic>.from(data as Map); final user=SessionUser.fromJson(Map<String,dynamic>.from(map['user'] as Map)); await SessionService.save(accessToken:'${map['accessToken']}',refreshToken:'${map['refreshToken']}',sessionId:map['sessionId']?.toString(),user:user); return user; }
}
