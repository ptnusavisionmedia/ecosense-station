import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../api/sensor_service.dart';
import '../models/user.dart';
import '../theme.dart';

class PeringatanScreen extends StatefulWidget {
  const PeringatanScreen({super.key, required this.currentUser});

  final AppUser currentUser;

  @override
  State<PeringatanScreen> createState() => _PeringatanScreenState();
}

class _PeringatanScreenState extends State<PeringatanScreen> {
  final _formKey = GlobalKey<FormState>();
  final _lowWaterCtrl = TextEditingController();
  final _phMinCtrl = TextEditingController();
  final _phMaxCtrl = TextEditingController();
  final _turbCtrl = TextEditingController();

  bool _loading = true;
  bool _saving = false;
  String? _error;
  String? _success;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _lowWaterCtrl.dispose();
    _phMinCtrl.dispose();
    _phMaxCtrl.dispose();
    _turbCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final client = await ApiClient.instance();
      final t = await SensorService(client).getThresholds();
      if (!mounted) return;
      _lowWaterCtrl.text = t.lowWaterCm.toString();
      _phMinCtrl.text = t.phMin.toString();
      _phMaxCtrl.text = t.phMax.toString();
      _turbCtrl.text = t.turbidityMaxNtu.toString();
      setState(() => _loading = false);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Gagal memuat ambang batas.';
        _loading = false;
      });
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
      _success = null;
    });
    try {
      final client = await ApiClient.instance();
      await SensorService(client).setThresholds({
        'lowWaterCm': double.parse(_lowWaterCtrl.text),
        'phMin': double.parse(_phMinCtrl.text),
        'phMax': double.parse(_phMaxCtrl.text),
        'turbidityMaxNtu': double.parse(_turbCtrl.text),
      });
      if (!mounted) return;
      setState(() => _success = 'Ambang batas berhasil disimpan.');
    } catch (e) {
      setState(() => _error = e is ApiException ? e.message : 'Gagal menyimpan ambang batas.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.currentUser.isAdmin) {
      return Scaffold(
        appBar: AppBar(title: const Text('Peringatan')),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'Hanya admin yang dapat mengatur ambang batas peringatan.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textMuted),
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Peringatan')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text(
                      'Atur ambang batas yang memicu alarm pada perangkat dan notifikasi.',
                      style: TextStyle(color: AppColors.textMuted, fontSize: 13),
                    ),
                    const SizedBox(height: 20),
                    _numField(_lowWaterCtrl, 'Batas Air Rendah (cm)'),
                    const SizedBox(height: 14),
                    _numField(_phMinCtrl, 'pH Minimum'),
                    const SizedBox(height: 14),
                    _numField(_phMaxCtrl, 'pH Maksimum'),
                    const SizedBox(height: 14),
                    _numField(_turbCtrl, 'Turbidity Maksimum (NTU)'),
                    if (_error != null) ...[
                      const SizedBox(height: 14),
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppColors.danger.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(_error!, style: const TextStyle(color: AppColors.danger, fontSize: 12.5)),
                      ),
                    ],
                    if (_success != null) ...[
                      const SizedBox(height: 14),
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppColors.brand.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(_success!, style: const TextStyle(color: AppColors.brandDark, fontSize: 12.5)),
                      ),
                    ],
                    const SizedBox(height: 22),
                    ElevatedButton(
                      onPressed: _saving ? null : _save,
                      child: _saving
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : const Text('Simpan Ambang Batas'),
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _numField(TextEditingController ctrl, String label) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600)),
        const SizedBox(height: 6),
        TextFormField(
          controller: ctrl,
          keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
          validator: (v) {
            if (v == null || v.trim().isEmpty) return 'Wajib diisi.';
            if (double.tryParse(v) == null) return 'Harus berupa angka.';
            return null;
          },
        ),
      ],
    );
  }
}
