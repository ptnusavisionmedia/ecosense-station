import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../api/api_client.dart';
import '../theme.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

const _kPollSecondsKey = 'poll_seconds';
const _kBaseUrlKey = 'base_url';
const _defaultPollSeconds = 10;

class _SettingsScreenState extends State<SettingsScreen> {
  int _pollSeconds = _defaultPollSeconds;
  final _baseUrlCtrl = TextEditingController();
  bool _loading = true;
  String? _savedMessage;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _baseUrlCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    if (!mounted) return;
    setState(() {
      _pollSeconds = prefs.getInt(_kPollSecondsKey) ?? _defaultPollSeconds;
      _baseUrlCtrl.text = prefs.getString(_kBaseUrlKey) ?? ApiClient.defaultBaseUrl;
      _loading = false;
    });
  }

  Future<void> _savePoll(int seconds) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_kPollSecondsKey, seconds);
    if (!mounted) return;
    setState(() {
      _pollSeconds = seconds;
      _savedMessage = 'Interval pembaruan disimpan.';
    });
  }

  Future<void> _saveBaseUrl() async {
    final prefs = await SharedPreferences.getInstance();
    final url = _baseUrlCtrl.text.trim();
    await prefs.setString(_kBaseUrlKey, url.isEmpty ? ApiClient.defaultBaseUrl : url);
    if (!mounted) return;
    setState(() => _savedMessage = 'Alamat server disimpan. Muat ulang aplikasi untuk menerapkan.');
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text('Interval Pembaruan Data', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          const Text(
            'Seberapa sering Home memuat ulang data sensor.',
            style: TextStyle(color: AppColors.textMuted, fontSize: 13),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 10,
            children: [5, 10, 30, 60].map((s) {
              final selected = s == _pollSeconds;
              return ChoiceChip(
                label: Text('$s detik'),
                selected: selected,
                onSelected: (_) => _savePoll(s),
                selectedColor: AppColors.brand.withValues(alpha: 0.18),
              );
            }).toList(),
          ),
          const SizedBox(height: 28),
          const Text('Alamat Server', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          const Text(
            'Default menggunakan 127.0.0.1:3000 melalui "adb reverse" saat USB tersambung.',
            style: TextStyle(color: AppColors.textMuted, fontSize: 13),
          ),
          const SizedBox(height: 10),
          TextField(controller: _baseUrlCtrl, decoration: const InputDecoration(labelText: 'Base URL')),
          const SizedBox(height: 10),
          ElevatedButton(onPressed: _saveBaseUrl, child: const Text('Simpan Alamat Server')),
          if (_savedMessage != null) ...[
            const SizedBox(height: 14),
            Text(_savedMessage!, style: const TextStyle(color: AppColors.brandDark, fontSize: 12.5)),
          ],
          const SizedBox(height: 28),
          const Divider(),
          const SizedBox(height: 10),
          const Text('Tentang', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          const Text(
            'EcoSense Station Mobile\nMonitoring kualitas & ketinggian air reservoir.',
            style: TextStyle(color: AppColors.textMuted, fontSize: 13),
          ),
        ],
      ),
    );
  }
}
