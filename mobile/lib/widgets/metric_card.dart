import 'package:flutter/material.dart';

class MetricCard extends StatelessWidget {
  final String icon;
  final String label;
  final double? value;
  final String unit;
  final Color accent;
  final int digits;
  final bool alarm;

  const MetricCard({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    required this.unit,
    required this.accent,
    this.digits = 1,
    this.alarm = false,
  });

  @override
  Widget build(BuildContext context) {
    final text = value == null ? '—' : value!.toStringAsFixed(digits);
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      decoration: BoxDecoration(
        color: const Color(0xFF141C2E).withValues(alpha: 0.75),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: alarm ? const Color(0xFFEF4444) : accent.withValues(alpha: 0.25),
          width: alarm ? 1.4 : 1,
        ),
        boxShadow: alarm
            ? [
                BoxShadow(
                  color: const Color(0xFFEF4444).withValues(alpha: 0.35),
                  blurRadius: 18,
                  spreadRadius: 1,
                ),
              ]
            : null,
      ),
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(icon, style: const TextStyle(fontSize: 20)),
          const SizedBox(height: 8),
          Text(
            label.toUpperCase(),
            style: const TextStyle(
              fontSize: 11,
              letterSpacing: 0.4,
              color: Color(0xFF93A1BD),
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 6),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                text,
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  color: alarm ? const Color(0xFFEF4444) : Colors.white,
                ),
              ),
              if (unit.isNotEmpty) ...[
                const SizedBox(width: 4),
                Text(
                  unit,
                  style: const TextStyle(fontSize: 12, color: Color(0xFF93A1BD)),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
