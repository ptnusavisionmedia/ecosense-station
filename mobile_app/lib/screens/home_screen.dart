import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../api/api_client.dart';
import '../api/sensor_service.dart';
import '../theme.dart';
import '../widgets/metric_card.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  LatestStatus? _status;
  String? _error;
  bool _loading = true;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _load();
    _timer = Timer.periodic(const Duration(seconds: 10), (_) => _load(silent: true));
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    try {
      final client = await ApiClient.instance();
      final status = await SensorService(client).latest();
      if (!mounted) return;
      setState(() {
        _status = status;
        _error = null;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Gagal memuat data sensor.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final reading = _status?.reading;
    final online = _status?.online ?? false;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Home'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Center(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: online ? AppColors.brand : AppColors.danger,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    online ? 'Online' : 'Offline',
                    style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_error != null)
                    Container(
                      padding: const EdgeInsets.all(12),
                      margin: const EdgeInsets.only(bottom: 12),
                      decoration: BoxDecoration(
                        color: AppColors.danger.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(_error!, style: const TextStyle(color: AppColors.danger, fontSize: 13)),
                    ),
                  const Text(
                    'Ringkasan kondisi reservoir saat ini.',
                    style: TextStyle(color: AppColors.textMuted, fontSize: 13),
                  ),
                  if (reading != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      'Data terakhir ${DateFormat('d/M/yyyy, HH:mm:ss').format(reading.time)}',
                      style: const TextStyle(color: AppColors.textMuted, fontSize: 11.5),
                    ),
                  ],
                  const SizedBox(height: 14),
                  GridView.count(
                    crossAxisCount: 2,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    childAspectRatio: 1.35,
                    children: [
                      MetricCard(
                        icon: Icons.water_drop_outlined,
                        label: 'Tinggi Air',
                        value: _fmt(reading?.waterHeightCm),
                        unit: 'cm',
                        alarm: reading?.lowWaterAlarm ?? false,
                      ),
                      MetricCard(
                        icon: Icons.science_outlined,
                        label: 'pH',
                        value: _fmt(reading?.ph, digits: 2),
                        alarm: reading?.phAlarm ?? false,
                      ),
                      MetricCard(
                        icon: Icons.blur_on,
                        label: 'Turbidity',
                        value: _fmt(reading?.turbidityNtu),
                        unit: 'NTU',
                        alarm: reading?.turbAlarm ?? false,
                      ),
                      MetricCard(
                        icon: Icons.water,
                        label: 'Flow',
                        value: _fmt(reading?.flowLpm),
                        unit: 'L/menit',
                      ),
                      MetricCard(
                        icon: Icons.inventory_2_outlined,
                        label: 'Volume Kumulatif',
                        value: _fmt(reading?.volumeL),
                        unit: 'L',
                      ),
                      MetricCard(
                        icon: Icons.thermostat_outlined,
                        label: 'Suhu',
                        value: _fmt(reading?.tempC),
                        unit: '°C',
                      ),
                      MetricCard(
                        icon: Icons.air,
                        label: 'Kelembapan',
                        value: _fmt(reading?.rh),
                        unit: '%',
                      ),
                    ],
                  ),
                ],
              ),
      ),
    );
  }

  String _fmt(double? v, {int digits = 1}) => v == null ? '—' : v.toStringAsFixed(digits);
}
