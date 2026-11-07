// Smoke test: pastikan aplikasi EcoSense Station Mobile bisa dirender tanpa
// error dan navigasi bawah (Dashboard/Histori/Pengaturan) tampil.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:ecosense_mobile/main.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('App renders root shell with bottom navigation', (WidgetTester tester) async {
    await tester.pumpWidget(const EcoSenseApp());
    await tester.pump();

    expect(find.text('EcoSense Station'), findsOneWidget);
    expect(find.byIcon(Icons.dashboard), findsOneWidget);
    expect(find.text('Dashboard'), findsOneWidget);
    expect(find.text('Histori'), findsOneWidget);
    expect(find.text('Pengaturan'), findsOneWidget);
  });

  testWidgets('Tapping Pengaturan tab shows settings screen', (WidgetTester tester) async {
    await tester.pumpWidget(const EcoSenseApp());
    await tester.pump();

    await tester.tap(find.text('Pengaturan'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.text('Alamat Backend'), findsOneWidget);
  });
}
