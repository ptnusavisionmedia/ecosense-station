import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../models/reading.dart';

class ApiException implements Exception {
  final String message;
  ApiException(this.message);
  @override
  String toString() => message;
}

/// Klien untuk backend EcoSense Station (lihat ../../backend/src/routes).
/// Base URL disimpan di SharedPreferences supaya pengguna bisa mengarahkan
/// aplikasi ke alamat backend-nya sendiri (laptop/server di jaringan lokal),
/// karena backend tidak di-deploy ke internet publik.
class ApiService {
  static const _prefKey = 'backend_base_url';
  static const defaultBaseUrl = 'http://10.0.2.2:3000';

  static Future<String> getBaseUrl() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_prefKey) ?? defaultBaseUrl;
  }

  static Future<void> setBaseUrl(String url) async {
    final prefs = await SharedPreferences.getInstance();
    var clean = url.trim();
    if (clean.endsWith('/')) clean = clean.substring(0, clean.length - 1);
    await prefs.setString(_prefKey, clean);
  }

  Future<Map<String, dynamic>> _getJson(String path) async {
    final base = await getBaseUrl();
    final uri = Uri.parse('$base$path');
    http.Response res;
    try {
      res = await http.get(uri).timeout(const Duration(seconds: 8));
    } catch (e) {
      throw ApiException('Tidak bisa terhubung ke backend di $base');
    }
    if (res.statusCode != 200) {
      throw ApiException('Backend membalas status ${res.statusCode}');
    }
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<(Reading?, bool)> fetchLatest() async {
    final json = await _getJson('/api/latest');
    final readingJson = json['reading'] as Map<String, dynamic>?;
    final reading = readingJson == null ? null : Reading.fromJson(readingJson);
    final online = json['online'] == true;
    return (reading, online);
  }

  Future<DeviceStatus> fetchStatus() async {
    final json = await _getJson('/api/status');
    return DeviceStatus.fromJson(json);
  }

  Future<List<Reading>> fetchHistory({
    required int fromMs,
    required int toMs,
    int limit = 5000,
  }) async {
    final json = await _getJson(
      '/api/history?from=$fromMs&to=$toMs&limit=$limit',
    );
    final list = (json['readings'] as List<dynamic>? ?? []);
    return list
        .map((e) => Reading.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}
