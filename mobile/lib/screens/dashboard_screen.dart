import 'dart:async';
import 'package:flutter/material.dart';

import '../models/reading.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../widgets/metric_card.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final _api = ApiService();
  Timer? _timer;

  Reading? _reading;
  DeviceStatus? _status;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _poll();
    _timer = Timer.periodic(const Duration(seconds: 10), (_) => _poll());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _poll() async {
    try {
      final results = await Future.wait([_api.fetchLatest(), _api.fetchStatus()]);
      final latest = results[0] as (Reading?, bool);
      final status = results[1] as DeviceStatus;
      if (!mounted) return;
      setState(() {
        _reading = latest.$1;
        _status = status;
        _loading = false;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  String _statusText() {
    if (_status == null) return 'Menghubungkan...';
    if (_status!.lastSeenTs == null) return 'Belum ada data';
    final agoSec = ((DateTime.now().millisecondsSinceEpoch - _status!.lastSeenTs!) / 1000)
        .round();
    final label = _status!.online ? 'Online' : 'Offline';
    return '$label — data terakhir ${agoSec}s lalu';
  }

  @override
  Widget build(BuildContext context) {
    final r = _reading;
    final s = _status;

    return RefreshIndicator(
      onRefresh: _poll,
      color: AppColors.accent,
      backgroundColor: AppColors.panel,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              Container(
                width: 10,
                height: 10,
                margin: const EdgeInsets.only(right: 8),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: s?.online == true ? AppColors.ok : AppColors.danger,
                ),
              ),
              Expanded(
                child: Text(
                  _statusText(),
                  style: const TextStyle(color: AppColors.textDim, fontSize: 13),
                ),
              ),
            ],
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.warn.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.warn.withValues(alpha: 0.4)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.wifi_off, color: AppColors.warn, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Tidak bisa terhubung ke backend.\n$_error\nPeriksa alamat backend di tab Pengaturan.',
                      style: const TextStyle(color: AppColors.warn, fontSize: 12.5),
                    ),
                  ),
                ],
              ),
            ),
          ],
          if (s?.hasAlarm == true) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.danger,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (s!.lowWaterAlarm)
                    const Text('⚠️ Air rendah AKTIF', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                  if (s.phAlarm)
                    const Text('⚠️ pH di luar ambang AKTIF', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                  if (s.turbAlarm)
                    const Text('⚠️ Turbidity di luar ambang AKTIF', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                ],
              ),
            ),
          ],
          const SizedBox(height: 16),
          if (_loading && r == null)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 60),
              child: Center(child: CircularProgressIndicator(color: AppColors.accent)),
            )
          else
            GridView.count(
              crossAxisCount: MediaQuery.of(context).size.width > 520 ? 3 : 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 1.15,
              children: [
                MetricCard(
                  icon: '💧',
                  label: 'Tinggi Air',
                  value: r?.waterHeightCm,
                  unit: 'cm',
                  accent: AppColors.water,
                  alarm: s?.lowWaterAlarm ?? false,
                ),
                MetricCard(
                  icon: '🧪',
                  label: 'pH',
                  value: r?.ph,
                  unit: '',
                  digits: 2,
                  accent: AppColors.ph,
                  alarm: s?.phAlarm ?? false,
                ),
                MetricCard(
                  icon: '🌫️',
                  label: 'Turbidity',
                  value: r?.turbidityNtu,
                  unit: 'NTU',
                  accent: AppColors.turb,
                  alarm: s?.turbAlarm ?? false,
                ),
                MetricCard(
                  icon: '🚿',
                  label: 'Flow',
                  value: r?.flowLpm,
                  unit: 'L/menit',
                  accent: AppColors.flow,
                ),
                MetricCard(
                  icon: '🪣',
                  label: 'Volume Kumulatif',
                  value: r?.volumeL,
                  unit: 'L',
                  accent: AppColors.volume,
                ),
                MetricCard(
                  icon: '🌡️',
                  label: 'Suhu',
                  value: r?.tempC,
                  unit: '°C',
                  accent: AppColors.temp,
                ),
                MetricCard(
                  icon: '☁️',
                  label: 'Kelembapan',
                  value: r?.rh,
                  unit: '%',
                  accent: AppColors.rh,
                ),
              ],
            ),
        ],
      ),
    );
  }
}
