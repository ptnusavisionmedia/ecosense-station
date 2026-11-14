class Reading {
  Reading({
    required this.deviceId,
    required this.ts,
    this.waterHeightCm,
    this.ph,
    this.turbidityNtu,
    this.flowLpm,
    this.volumeL,
    this.tempC,
    this.rh,
    this.lowWaterAlarm = false,
    this.phAlarm = false,
    this.turbAlarm = false,
  });

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

  DateTime get time => DateTime.fromMillisecondsSinceEpoch(ts);

  factory Reading.fromJson(Map<String, dynamic> json) => Reading(
        deviceId: json['deviceId'] as String? ?? '',
        ts: (json['ts'] as num?)?.toInt() ?? 0,
        waterHeightCm: (json['waterHeightCm'] as num?)?.toDouble(),
        ph: (json['ph'] as num?)?.toDouble(),
        turbidityNtu: (json['turbidityNtu'] as num?)?.toDouble(),
        flowLpm: (json['flowLpm'] as num?)?.toDouble(),
        volumeL: (json['volumeL'] as num?)?.toDouble(),
        tempC: (json['tempC'] as num?)?.toDouble(),
        rh: (json['rh'] as num?)?.toDouble(),
        lowWaterAlarm: json['lowWaterAlarm'] == true || json['lowWaterAlarm'] == 1,
        phAlarm: json['phAlarm'] == true || json['phAlarm'] == 1,
        turbAlarm: json['turbAlarm'] == true || json['turbAlarm'] == 1,
      );
}

class Thresholds {
  Thresholds({
    required this.lowWaterCm,
    required this.phMin,
    required this.phMax,
    required this.turbidityMaxNtu,
  });

  final double lowWaterCm;
  final double phMin;
  final double phMax;
  final double turbidityMaxNtu;

  factory Thresholds.fromJson(Map<String, dynamic> json) => Thresholds(
        lowWaterCm: (json['lowWaterCm'] as num).toDouble(),
        phMin: (json['phMin'] as num).toDouble(),
        phMax: (json['phMax'] as num).toDouble(),
        turbidityMaxNtu: (json['turbidityMaxNtu'] as num).toDouble(),
      );
}
