import 'package:dio/dio.dart';
import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:path_provider/path_provider.dart';

/// Backend EcoSense Station dipakai lewat sesi cookie httpOnly (lihat
/// backend/src/auth.js), jadi klien mobile perlu menyimpan & mengirim
/// ulang cookie `sid` persis seperti browser. `PersistCookieJar` menjaga
/// cookie itu tetap ada walau app ditutup, supaya user tidak perlu
/// login ulang setiap buka app.
///
/// Base URL default `http://127.0.0.1:3000` mengasumsikan HP terhubung
/// lewat kabel USB dengan `adb reverse tcp:3000 tcp:3000` aktif (lihat
/// README mobile_app). Untuk pemakaian lewat WiFi, ganti ke IP LAN PC,
/// misalnya `http://192.168.100.216:3000`.
class ApiClient {
  ApiClient._(this.dio, this.cookieJar);

  final Dio dio;
  // Disimpan supaya logout bisa benar-benar menghapus cookie sesi dari
  // disk, bukan cuma mengandalkan POST /api/auth/logout berhasil.
  final CookieJar cookieJar;
  static ApiClient? _instance;

  static Future<ApiClient> instance({String? baseUrl}) async {
    if (_instance != null) return _instance!;
    final dir = await getApplicationDocumentsDirectory();
    final cookieJar = PersistCookieJar(storage: FileStorage('${dir.path}/.cookies'));
    final dio = Dio(BaseOptions(
      baseUrl: baseUrl ?? defaultBaseUrl,
      connectTimeout: const Duration(seconds: 8),
      receiveTimeout: const Duration(seconds: 10),
      headers: {'Content-Type': 'application/json'},
      validateStatus: (code) => code != null && code < 500,
    ));
    dio.interceptors.add(CookieManager(cookieJar));
    _instance = ApiClient._(dio, cookieJar);
    return _instance!;
  }

  static const defaultBaseUrl = 'http://127.0.0.1:3000';

  static void reset() => _instance = null;
}

class ApiException implements Exception {
  ApiException(this.message);
  final String message;
  @override
  String toString() => message;
}

String extractErrorMessage(Response res, String fallback) {
  final data = res.data;
  if (data is Map && data['error'] is String) return data['error'] as String;
  return fallback;
}
