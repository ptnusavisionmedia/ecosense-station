class Reading {
  final int id;
  final String deviceId;
  final int ts;
  final double? waterHeightCm;
  final double? ph;
  final double? turbidityNtu;
  final double? flowLpm;
  final double? volumeL;
  final double? tempC;
  final double? rh;
  final bool lowWaterAlarm;
  final bool phAlarm;
  final bool turbAlarm;

  Reading({
    required this.id,
    required this.deviceId,
    required this.ts,
    this.waterHeightCm,
    this.ph,
    this.turbidityNtu,
    this.flowLpm,
    this.volumeL,
    this.tempC,
    this.rh,
    required this.lowWaterAlarm,
    required this.phAlarm,
    required this.turbAlarm,
  });

  static double? _num(dynamic v) {
    if (v == null) return null;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString());
  }

  static bool _boolish(dynamic v) {
    if (v == null) return false;
    if (v is bool) return v;
    if (v is num) return v != 0;
    return false;
  }

  factory Reading.fromJson(Map<String, dynamic> json) {
    return Reading(
      id: (json['id'] as num?)?.toInt() ?? 0,
      deviceId: json['deviceId']?.toString() ?? '',
      ts: (json['ts'] as num?)?.toInt() ?? 0,
      waterHeightCm: _num(json['waterHeightCm']),
      ph: _num(json['ph']),
      turbidityNtu: _num(json['turbidityNtu']),
      flowLpm: _num(json['flowLpm']),
      volumeL: _num(json['volumeL']),
      tempC: _num(json['tempC']),
      rh: _num(json['rh']),
      lowWaterAlarm: _boolish(json['lowWaterAlarm']),
      phAlarm: _boolish(json['phAlarm']),
      turbAlarm: _boolish(json['turbAlarm']),
    );
  }
}

class DeviceStatus {
  final bool online;
  final int? lastSeenTs;
  final bool lowWaterAlarm;
  final bool phAlarm;
  final bool turbAlarm;

  DeviceStatus({
    required this.online,
    required this.lastSeenTs,
    required this.lowWaterAlarm,
    required this.phAlarm,
    required this.turbAlarm,
  });

  factory DeviceStatus.fromJson(Map<String, dynamic> json) {
    final alarms = (json['alarms'] as Map<String, dynamic>?) ?? {};
    return DeviceStatus(
      online: json['online'] == true,
      lastSeenTs: (json['lastSeenTs'] as num?)?.toInt(),
      lowWaterAlarm: alarms['lowWaterAlarm'] == true,
      phAlarm: alarms['phAlarm'] == true,
      turbAlarm: alarms['turbAlarm'] == true,
    );
  }

  bool get hasAlarm => lowWaterAlarm || phAlarm || turbAlarm;
}
