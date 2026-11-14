import 'package:dio/dio.dart';
import '../models/user.dart';
import 'api_client.dart';

class AuthService {
  AuthService(this._client);
  final ApiClient _client;

  Future<AppUser> login(String username, String password) async {
    final res = await _client.dio.post('/api/auth/login', data: {
      'username': username,
      'password': password,
    });
    if (res.statusCode != 200) {
      throw ApiException(extractErrorMessage(res, 'Username atau password salah.'));
    }
    return AppUser.fromJson(res.data as Map<String, dynamic>);
  }

  Future<AppUser?> currentUser() async {
    try {
      final res = await _client.dio.get('/api/auth/me');
      if (res.statusCode != 200) return null;
      return AppUser.fromJson(res.data as Map<String, dynamic>);
    } on DioException {
      return null;
    } catch (_) {
      // Respons tidak sesuai bentuk yang diharapkan (mis. body berubah) —
      // jangan sampai lempar error mentah yang tidak ditangani pemanggil,
      // cukup anggap sesi tidak valid.
      return null;
    }
  }

  Future<void> logout() async {
    try {
      await _client.dio.post('/api/auth/logout');
    } on DioException {
      // Diabaikan — tetap lanjut hapus cookie di sisi klien walau request
      // ke server gagal (mis. offline), supaya sesi lama tidak tertinggal
      // tersimpan di disk device ini.
    }
    await _client.cookieJar.deleteAll();
  }

  Future<void> changePassword(String newPassword) async {
    final res = await _client.dio.put('/api/auth/password', data: {
      'password': newPassword,
    });
    if (res.statusCode != 200) {
      throw ApiException(extractErrorMessage(res, 'Gagal mengganti password.'));
    }
  }
}
