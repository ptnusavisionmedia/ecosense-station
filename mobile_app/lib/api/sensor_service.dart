import '../models/reading.dart';
import '../models/user.dart';
import 'api_client.dart';

class LatestStatus {
  LatestStatus({required this.reading, required this.online});
  final Reading? reading;
  final bool online;
}

class SensorService {
  SensorService(this._client);
  final ApiClient _client;

  Future<LatestStatus> latest({String? deviceId}) async {
    final res = await _client.dio.get('/api/latest', queryParameters: {
      if (deviceId != null) 'deviceId': deviceId,
    });
    final data = res.data as Map<String, dynamic>;
    final readingJson = data['reading'] as Map<String, dynamic>?;
    return LatestStatus(
      reading: readingJson == null ? null : Reading.fromJson(readingJson),
      online: data['online'] == true,
    );
  }

  Future<List<Reading>> history({
    String? deviceId,
    DateTime? from,
    DateTime? to,
    int limit = 500,
  }) async {
    final res = await _client.dio.get('/api/history', queryParameters: {
      if (deviceId != null) 'deviceId': deviceId,
      if (from != null) 'from': from.millisecondsSinceEpoch,
      if (to != null) 'to': to.millisecondsSinceEpoch,
      'limit': limit,
    });
    final data = res.data as Map<String, dynamic>;
    final rows = (data['readings'] as List).cast<Map<String, dynamic>>();
    return rows.map(Reading.fromJson).toList();
  }

  Future<Thresholds> getThresholds() async {
    final res = await _client.dio.get('/api/config/thresholds');
    return Thresholds.fromJson(res.data as Map<String, dynamic>);
  }

  Future<Thresholds> setThresholds(Map<String, double> partial) async {
    final res = await _client.dio.put('/api/config/thresholds', data: partial);
    if (res.statusCode != 200) {
      throw ApiException(extractErrorMessage(res, 'Gagal menyimpan ambang batas.'));
    }
    return Thresholds.fromJson(res.data as Map<String, dynamic>);
  }

  Future<List<AppUser>> listUsers() async {
    final res = await _client.dio.get('/api/users');
    if (res.statusCode != 200) {
      throw ApiException(extractErrorMessage(res, 'Gagal memuat daftar pengguna.'));
    }
    final rows = (res.data as List).cast<Map<String, dynamic>>();
    return rows.map(AppUser.fromJson).toList();
  }

  Future<void> createUser(String username, String password, String role) async {
    final res = await _client.dio.post('/api/users', data: {
      'username': username,
      'password': password,
      'role': role,
    });
    if (res.statusCode != 201) {
      throw ApiException(extractErrorMessage(res, 'Gagal menambah pengguna.'));
    }
  }

  Future<void> deleteUser(int id) async {
    final res = await _client.dio.delete('/api/users/$id');
    if (res.statusCode != 200) {
      throw ApiException(extractErrorMessage(res, 'Gagal menghapus pengguna.'));
    }
  }
}
