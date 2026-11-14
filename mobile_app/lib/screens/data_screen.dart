import 'package:flutter/material.dart';
import 'package:syncfusion_flutter_charts/charts.dart';
import 'package:intl/intl.dart';
import '../api/api_client.dart';
import '../api/sensor_service.dart';
import '../models/reading.dart';
import '../theme.dart';

class DataScreen extends StatefulWidget {
  const DataScreen({super.key});

  @override
  State<DataScreen> createState() => _DataScreenState();
}

enum _RangeOption { today, week }

class _DataScreenState extends State<DataScreen> {
  List<Reading> _readings = [];
  bool _loading = true;
  String? _error;
  _RangeOption _range = _RangeOption.today;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final client = await ApiClient.instance();
      final now = DateTime.now();
      final from = _range == _RangeOption.today
          ? DateTime(now.year, now.month, now.day)
          : now.subtract(const Duration(days: 7));
      final rows = await SensorService(client).history(from: from, to: now, limit: 1000);
      if (!mounted) return;
      setState(() {
        _readings = rows;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Gagal memuat histori data.';
        _loading = false;
      });
    }
  }

  List<Reading> get _alerts =>
      _readings.where((r) => r.lowWaterAlarm || r.phAlarm || r.turbAlarm).toList().reversed.toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Data'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(48),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            child: SegmentedButton<_RangeOption>(
              segments: const [
                ButtonSegment(value: _RangeOption.today, label: Text('Hari Ini')),
                ButtonSegment(value: _RangeOption.week, label: Text('7 Hari')),
              ],
              selected: {_range},
              onSelectionChanged: (s) {
                setState(() => _range = s.first);
                _load();
              },
            ),
          ),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_error != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Text(_error!, style: const TextStyle(color: AppColors.danger)),
                    ),
                  if (_readings.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 40),
                      child: Center(
                        child: Text('Belum ada data untuk rentang ini.', style: TextStyle(color: AppColors.textMuted)),
                      ),
                    )
                  else ...[
                    _buildChartCard(
                      title: 'Tinggi Air',
                      unit: 'cm',
                      color: AppColors.brand,
                      selector: (r) => r.waterHeightCm,
                    ),
                    const SizedBox(height: 14),
                    _buildChartCard(
                      title: 'pH',
                      unit: '',
                      color: AppColors.brandDark,
                      selector: (r) => r.ph,
                    ),
                    const SizedBox(height: 14),
                    _buildChartCard(
                      title: 'Turbidity',
                      unit: 'NTU',
                      color: AppColors.warning,
                      selector: (r) => r.turbidityNtu,
                    ),
                  ],
                  const SizedBox(height: 20),
                  const Text('Log Alarm', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  if (_alerts.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 16),
                      child: Text('Tidak ada alarm pada rentang ini.', style: TextStyle(color: AppColors.textMuted)),
                    )
                  else
                    ..._alerts.take(50).map(_alertTile),
                ],
              ),
            ),
    );
  }

  Widget _buildChartCard({
    required String title,
    required String unit,
    required Color color,
    required double? Function(Reading) selector,
  }) {
    final data = _readings.where((r) => selector(r) != null).toList();
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(4, 14, 12, 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(left: 14),
              child: Text(
                unit.isEmpty ? title : '$title ($unit)',
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5),
              ),
            ),
            SizedBox(
              height: 220,
              child: data.isEmpty
                  ? const Center(child: Text('Tidak ada data', style: TextStyle(color: AppColors.textMuted, fontSize: 12)))
                  : SfCartesianChart(
                      margin: const EdgeInsets.fromLTRB(0, 8, 8, 0),
                      plotAreaBorderWidth: 0,
                      primaryXAxis: DateTimeAxis(
                        dateFormat: _range == _RangeOption.today ? DateFormat('HH:mm') : DateFormat('d/M'),
                        majorGridLines: const MajorGridLines(width: 0),
                        axisLine: const AxisLine(width: 0.6, color: AppColors.border),
                        labelStyle: const TextStyle(fontSize: 10, color: AppColors.textMuted),
                      ),
                      primaryYAxis: NumericAxis(
                        majorGridLines: const MajorGridLines(width: 0.6, color: AppColors.border, dashArray: [4, 4]),
                        axisLine: const AxisLine(width: 0),
                        labelStyle: const TextStyle(fontSize: 10, color: AppColors.textMuted),
                      ),
                      tooltipBehavior: TooltipBehavior(enable: true, header: ''),
                      trackballBehavior: TrackballBehavior(
                        enable: true,
                        activationMode: ActivationMode.singleTap,
                        tooltipSettings: const InteractiveTooltip(enable: true),
                        lineType: TrackballLineType.vertical,
                      ),
                      series: <CartesianSeries<Reading, DateTime>>[
                        SplineAreaSeries<Reading, DateTime>(
                          dataSource: data,
                          xValueMapper: (r, _) => r.time,
                          yValueMapper: (r, _) => selector(r),
                          color: color.withValues(alpha: 0.12),
                          borderColor: color,
                          borderWidth: 2.5,
                          splineType: SplineType.monotonic,
                          markerSettings: const MarkerSettings(isVisible: false),
                          name: title,
                        ),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _alertTile(Reading r) {
    final labels = <String>[
      if (r.lowWaterAlarm) 'Air Rendah',
      if (r.phAlarm) 'pH Tidak Normal',
      if (r.turbAlarm) 'Turbidity Tinggi',
    ];
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.danger.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.danger.withValues(alpha: 0.2)),
      ),
      child: Row(
        children: [
          const Icon(Icons.warning_amber_rounded, color: AppColors.danger, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(labels.join(', '), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                Text(
                  DateFormat('d/M/yyyy, HH:mm:ss').format(r.time),
                  style: const TextStyle(color: AppColors.textMuted, fontSize: 11.5),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
