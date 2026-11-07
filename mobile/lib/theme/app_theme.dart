import 'package:flutter/material.dart';

/// Palet warna disamakan dengan dashboard web (lihat ../../../web/css/style.css)
/// supaya tampilan mobile & web terasa satu identitas.
class AppColors {
  static const bg = Color(0xFF070B14);
  static const panel = Color(0xFF141C2E);
  static const panelBorder = Color(0x2E94A3B8);
  static const text = Color(0xFFE9EEFB);
  static const textDim = Color(0xFF93A1BD);
  static const accent = Color(0xFF38BDF8);
  static const accent2 = Color(0xFF22D3EE);
  static const ok = Color(0xFF22C55E);
  static const danger = Color(0xFFEF4444);
  static const warn = Color(0xFFF59E0B);

  static const water = Color(0xFF38BDF8);
  static const ph = Color(0xFF22C55E);
  static const turb = Color(0xFFF59E0B);
  static const flow = Color(0xFFA855F7);
  static const volume = Color(0xFF06B6D4);
  static const temp = Color(0xFFEF4444);
  static const rh = Color(0xFF818CF8);
}

ThemeData buildAppTheme() {
  final base = ThemeData.dark(useMaterial3: true);
  return base.copyWith(
    scaffoldBackgroundColor: AppColors.bg,
    colorScheme: base.colorScheme.copyWith(
      primary: AppColors.accent,
      secondary: AppColors.accent2,
      surface: AppColors.panel,
      error: AppColors.danger,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.bg,
      elevation: 0,
      centerTitle: false,
      foregroundColor: AppColors.text,
    ),
    cardTheme: CardThemeData(
      color: AppColors.panel,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: AppColors.panelBorder),
      ),
    ),
    textTheme: base.textTheme.apply(
      bodyColor: AppColors.text,
      displayColor: AppColors.text,
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: AppColors.panel,
      indicatorColor: AppColors.accent.withValues(alpha: 0.25),
      labelTextStyle: WidgetStateProperty.all(
        const TextStyle(color: AppColors.text, fontSize: 12),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white.withValues(alpha: 0.04),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: AppColors.panelBorder),
      ),
    ),
  );
}
