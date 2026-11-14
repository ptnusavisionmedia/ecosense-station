import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:intl/intl.dart';

import '../models/reading.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

enum _RangePreset { h24, d7, d30 }

class _HistoryScreenState extends State<HistoryScreen> {
  final _api = ApiService();
  List<Reading> _readings = [];
  bool _loading = true;
  String? _error;
  _RangePreset _range = _RangePreset.h24;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Duration _rangeDuration() {
    switch (_range) {
      case _RangePreset.h24:
        return const Duration(hours: 24);
      case _RangePreset.d7:
        return const Duration(days: 7);
      case _RangePreset.d30:
        return const Duration(days: 30);
    }
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final to = DateTime.now();
      final from = to.subtract(_rangeDuration());
      final readings = await _api.fetchHistory(
        fromMs: from.millisecondsSinceEpoch,
        toMs: to.millisecondsSinceEpoch,
      );
      if (!mounted) return;
      setState(() {
        _readings = readings;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  List<FlSpot> _spots(double? Function(Reading) pick) {
    if (_readings.isEmpty) return [];
    final t0 = _readings.first.ts.toDouble();
    final spots = <FlSpot>[];
    for (final r in _readings) {
      final v = pick(r);
      if (v == null) continue;
      spots.add(FlSpot((r.ts.toDouble() - t0) / 60000.0, v));
    }
    return spots;
  }

  Widget _chartCard(String title, List<_Series> series) {
    final allSpots = series.expand((s) => s.spots).toList();
    final hasData = allSpots.isNotEmpty;

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.fromLTRB(12, 14, 16, 10),
      decoration: BoxDecoration(
        color: AppColors.panel.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.panelBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
              ),
              ...series.map(
                (s) => Padding(
                  padding: const EdgeInsets.only(left: 10),
                  child: Row(
                    children: [
                      Container(width: 10, height: 10, color: s.color),
                      const SizedBox(width: 4),
                      Text(s.label, style: const TextStyle(fontSize: 11, color: AppColors.textDim)),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 180,
            child: !hasData
                ? const Center(
                    child: Text('Belum ada data pada rentang ini', style: TextStyle(color: AppColors.textDim)),
                  )
                : LineChart(
                    LineChartData(
                      gridData: FlGridData(
                        show: true,
                        getDrawingHorizontalLine: (_) => FlLine(color: AppColors.panelBorder, strokeWidth: 1),
                        getDrawingVerticalLine: (_) => FlLine(color: AppColors.panelBorder, strokeWidth: 1),
                      ),
                      titlesData: const FlTitlesData(
                        topTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
                        rightTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
                        bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
                        leftTitles: AxisTitles(
                          sideTitles: SideTitles(
                            showTitles: true,
                            reservedSize: 34,
                            getTitlesWidget: _leftLabel,
                          ),
                        ),
                      ),
                      borderData: FlBorderData(show: false),
                      lineTouchData: LineTouchData(
                        touchTooltipData: LineTouchTooltipData(
                          getTooltipColor: (_) => AppColors.panel,
                        ),
                      ),
                      lineBarsData: series
                          .map(
                            (s) => LineChartBarData(
                              spots: s.spots,
                              isCurved: true,
                              curveSmoothness: 0.3,
                              color: s.color,
                              barWidth: 2.4,
                              dotData: const FlDotData(show: false),
                              belowBarData: s.fill
                                  ? BarAreaData(
                                      show: true,
                                      gradient: LinearGradient(
                                        begin: Alignment.topCenter,
                                        end: Alignment.bottomCenter,
                                        colors: [
                                          s.color.withValues(alpha: 0.35),
                                          s.color.withValues(alpha: 0.0),
                                        ],
                                      ),
                                    )
                                  : BarAreaData(show: false),
                            ),
                          )
                          .toList(),
                    ),
                    duration: const Duration(milliseconds: 500),
                  ),
          ),
        ],
      ),
    );
  }

  static Widget _leftLabel(double value, TitleMeta meta) {
    return Text(
      value.toStringAsFixed(0),
      style: const TextStyle(color: AppColors.textDim, fontSize: 10),
    );
  }

  double? _totalVolumeDiff() {
    final volumes = _readings.map((r) => r.volumeL).whereType<double>().toList();
    if (volumes.length < 2) return null;
    return volumes.last - volumes.first;
  }

  @override
  Widget build(BuildContext context) {
    final totalVol = _totalVolumeDiff();

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.accent,
      backgroundColor: AppColors.panel,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          SegmentedButton<_RangePreset>(
            segments: const [
              ButtonSegment(value: _RangePreset.h24, label: Text('24 Jam')),
              ButtonSegment(value: _RangePreset.d7, label: Text('7 Hari')),
              ButtonSegment(value: _RangePreset.d30, label: Text('30 Hari')),
            ],
            selected: {_range},
            onSelectionChanged: (s) {
              setState(() => _range = s.first);
              _load();
            },
          ),
          const SizedBox(height: 14),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(
                'Gagal memuat histori: $_error',
                style: const TextStyle(color: AppColors.danger, fontSize: 12.5),
              ),
            ),
          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 60),
              child: Center(child: CircularProgressIndicator(color: AppColors.accent)),
            )
          else ...[
            Container(
              padding: const EdgeInsets.all(12),
              margin: const EdgeInsets.only(bottom: 14),
              decoration: BoxDecoration(
                color: AppColors.panel.withValues(alpha: 0.7),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.panelBorder),
              ),
              child: Text(
                totalVol == null
                    ? 'Total pemakaian air periode ini: data belum cukup'
                    : 'Total pemakaian air periode ini: ${totalVol.toStringAsFixed(1)} L · '
                        '${_readings.length} pembacaan · diperbarui ${DateFormat('HH:mm:ss').format(DateTime.now())}',
                style: const TextStyle(fontSize: 12.5),
              ),
            ),
            _chartCard('Tinggi Air (cm)', [
              _Series('Tinggi air', _spots((r) => r.waterHeightCm), AppColors.water, fill: true),
            ]),
            _chartCard('pH & Turbidity', [
              _Series('pH', _spots((r) => r.ph), AppColors.ph, fill: true),
              _Series('Turbidity', _spots((r) => r.turbidityNtu), AppColors.turb),
            ]),
            _chartCard('Suhu (°C) & Kelembapan (%)', [
              _Series('Suhu', _spots((r) => r.tempC), AppColors.temp, fill: true),
              _Series('Kelembapan', _spots((r) => r.rh), AppColors.rh),
            ]),
          ],
        ],
      ),
    );
  }
}

class _Series {
  final String label;
  final List<FlSpot> spots;
  final Color color;
  final bool fill;
  _Series(this.label, this.spots, this.color, {this.fill = false});
}
