import 'package:flutter/material.dart';

import '../services/api_service.dart';
import '../theme/app_theme.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _controller = TextEditingController();
  bool _loading = true;
  bool _testing = false;
  String? _testResult;
  bool? _testOk;

  @override
  void initState() {
    super.initState();
    _loadCurrent();
  }

  Future<void> _loadCurrent() async {
    final url = await ApiService.getBaseUrl();
    setState(() {
      _controller.text = url;
      _loading = false;
    });
  }

  Future<void> _save() async {
    await ApiService.setBaseUrl(_controller.text);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Alamat backend disimpan.')),
    );
  }

  Future<void> _testConnection() async {
    setState(() {
      _testing = true;
      _testResult = null;
      _testOk = null;
    });
    await ApiService.setBaseUrl(_controller.text);
    try {
      await ApiService().fetchStatus();
      setState(() {
        _testing = false;
        _testOk = true;
        _testResult = 'Berhasil terhubung ke backend!';
      });
    } catch (e) {
      setState(() {
        _testing = false;
        _testOk = false;
        _testResult = 'Gagal terhubung: $e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: AppColors.accent));
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text(
          'Alamat Backend',
          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
        ),
        const SizedBox(height: 6),
        const Text(
          'Backend EcoSense Station berjalan di komputer/server kamu sendiri '
          '(bukan di internet publik). Isi alamat IP + port tempat backend '
          'berjalan, contoh: http://192.168.1.10:3000 — pastikan HP dan '
          'komputer backend berada di jaringan WiFi yang sama.',
          style: TextStyle(color: AppColors.textDim, fontSize: 12.5),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _controller,
          keyboardType: TextInputType.url,
          decoration: const InputDecoration(
            labelText: 'Base URL backend',
            hintText: 'http://192.168.1.10:3000',
          ),
        ),
        const SizedBox(height: 14),
        Row(
          children: [
            Expanded(
              child: FilledButton.icon(
                onPressed: _testing ? null : _testConnection,
                icon: _testing
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.wifi_tethering),
                label: const Text('Tes Koneksi'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _save,
                icon: const Icon(Icons.save),
                label: const Text('Simpan'),
              ),
            ),
          ],
        ),
        if (_testResult != null) ...[
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: (_testOk == true ? AppColors.ok : AppColors.danger).withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: (_testOk == true ? AppColors.ok : AppColors.danger).withValues(alpha: 0.4),
              ),
            ),
            child: Text(
              _testResult!,
              style: TextStyle(
                color: _testOk == true ? AppColors.ok : AppColors.danger,
                fontSize: 13,
              ),
            ),
          ),
        ],
        const SizedBox(height: 28),
        const Divider(color: AppColors.panelBorder),
        const SizedBox(height: 14),
        const Text(
          'Tentang',
          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
        ),
        const SizedBox(height: 6),
        const Text(
          'EcoSense Station Mobile — monitoring tinggi air, pH, turbidity, '
          'flow, volume, suhu, dan kelembapan reservoir secara real-time. '
          'Notifikasi alarm juga tersedia lewat bot Telegram — kirim /start '
          'ke bot EcoSense Station di Telegram.',
          style: TextStyle(color: AppColors.textDim, fontSize: 12.5),
        ),
      ],
    );
  }
}
