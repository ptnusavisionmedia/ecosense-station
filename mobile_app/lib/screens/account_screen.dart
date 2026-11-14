import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../api/auth_service.dart';
import '../api/sensor_service.dart';
import '../models/user.dart';
import '../theme.dart';

class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key, required this.currentUser, required this.onLoggedOut});

  final AppUser currentUser;
  final VoidCallback onLoggedOut;

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  final _pwFormKey = GlobalKey<FormState>();
  final _newPwCtrl = TextEditingController();
  bool _obscurePassword = true;
  bool _savingPw = false;
  String? _pwError;
  String? _pwSuccess;

  List<AppUser> _users = [];
  bool _loadingUsers = false;
  String? _usersError;

  @override
  void initState() {
    super.initState();
    if (widget.currentUser.isAdmin) _loadUsers();
  }

  @override
  void dispose() {
    _newPwCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadUsers() async {
    setState(() {
      _loadingUsers = true;
      _usersError = null;
    });
    try {
      final client = await ApiClient.instance();
      final users = await SensorService(client).listUsers();
      if (!mounted) return;
      setState(() {
        _users = users;
        _loadingUsers = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _usersError = 'Gagal memuat daftar pengguna.';
        _loadingUsers = false;
      });
    }
  }

  Future<void> _changePassword() async {
    if (!_pwFormKey.currentState!.validate()) return;
    setState(() {
      _savingPw = true;
      _pwError = null;
      _pwSuccess = null;
    });
    try {
      final client = await ApiClient.instance();
      await AuthService(client).changePassword(_newPwCtrl.text);
      if (!mounted) return;
      _newPwCtrl.clear();
      setState(() => _pwSuccess = 'Password berhasil diganti.');
    } catch (e) {
      setState(() => _pwError = e is ApiException ? e.message : 'Gagal mengganti password.');
    } finally {
      if (mounted) setState(() => _savingPw = false);
    }
  }

  Future<void> _logout() async {
    final client = await ApiClient.instance();
    await AuthService(client).logout();
    widget.onLoggedOut();
  }

  Future<void> _addUserDialog() async {
    final formKey = GlobalKey<FormState>();
    final usernameCtrl = TextEditingController();
    final passwordCtrl = TextEditingController();
    String role = 'viewer';
    String? error;

    await showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setStateDialog) => AlertDialog(
          title: const Text('Tambah Pengguna'),
          content: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: usernameCtrl,
                  decoration: const InputDecoration(labelText: 'Username'),
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Wajib diisi.' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: passwordCtrl,
                  decoration: const InputDecoration(labelText: 'Password'),
                  validator: (v) => (v == null || v.length < 4) ? 'Minimal 4 karakter.' : null,
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: role,
                  decoration: const InputDecoration(labelText: 'Role'),
                  items: const [
                    DropdownMenuItem(value: 'admin', child: Text('Admin')),
                    DropdownMenuItem(value: 'viewer', child: Text('Viewer')),
                  ],
                  onChanged: (v) => setStateDialog(() => role = v ?? 'viewer'),
                ),
                if (error != null) ...[
                  const SizedBox(height: 10),
                  Text(error!, style: const TextStyle(color: AppColors.danger, fontSize: 12.5)),
                ],
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('Batal')),
            TextButton(
              onPressed: () async {
                if (!formKey.currentState!.validate()) return;
                try {
                  final client = await ApiClient.instance();
                  await SensorService(client).createUser(usernameCtrl.text.trim(), passwordCtrl.text, role);
                  if (ctx.mounted) Navigator.of(ctx).pop();
                  _loadUsers();
                } catch (e) {
                  setStateDialog(() => error = e is ApiException ? e.message : 'Gagal menambah pengguna.');
                }
              },
              child: const Text('Tambah'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _deleteUser(AppUser user) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Hapus Pengguna'),
        content: Text('Hapus pengguna "${user.username}"?'),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Batal')),
          TextButton(onPressed: () => Navigator.of(ctx).pop(true), child: const Text('Hapus')),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      final client = await ApiClient.instance();
      await SensorService(client).deleteUser(user.id);
      _loadUsers();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e is ApiException ? e.message : 'Gagal menghapus pengguna.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Account')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 24,
                    backgroundColor: AppColors.brand.withValues(alpha: 0.15),
                    child: Text(
                      widget.currentUser.username.isNotEmpty ? widget.currentUser.username[0].toUpperCase() : '?',
                      style: const TextStyle(color: AppColors.brandDark, fontWeight: FontWeight.w800, fontSize: 18),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(widget.currentUser.username, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                        Text(
                          widget.currentUser.isAdmin ? 'Admin' : 'Viewer',
                          style: const TextStyle(color: AppColors.textMuted, fontSize: 12.5),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          const Text('Ganti Password', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
          const SizedBox(height: 10),
          Form(
            key: _pwFormKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextFormField(
                  controller: _newPwCtrl,
                  obscureText: _obscurePassword,
                  decoration: InputDecoration(
                    labelText: 'Password Baru',
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                        color: AppColors.textMuted,
                      ),
                      tooltip: _obscurePassword ? 'Perlihatkan password' : 'Sembunyikan password',
                      onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                    ),
                  ),
                  validator: (v) => (v == null || v.length < 4) ? 'Minimal 4 karakter.' : null,
                ),
                if (_pwError != null) ...[
                  const SizedBox(height: 10),
                  Text(_pwError!, style: const TextStyle(color: AppColors.danger, fontSize: 12.5)),
                ],
                if (_pwSuccess != null) ...[
                  const SizedBox(height: 10),
                  Text(_pwSuccess!, style: const TextStyle(color: AppColors.brandDark, fontSize: 12.5)),
                ],
                const SizedBox(height: 12),
                ElevatedButton(
                  onPressed: _savingPw ? null : _changePassword,
                  child: _savingPw
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Simpan Password'),
                ),
              ],
            ),
          ),
          if (widget.currentUser.isAdmin) ...[
            const SizedBox(height: 28),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Manajemen Pengguna', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                IconButton(
                  onPressed: _addUserDialog,
                  icon: const Icon(Icons.person_add_alt_1_outlined, color: AppColors.brandDark),
                  tooltip: 'Tambah pengguna',
                ),
              ],
            ),
            const SizedBox(height: 6),
            if (_loadingUsers)
              const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator()))
            else if (_usersError != null)
              Padding(padding: const EdgeInsets.all(8), child: Text(_usersError!, style: const TextStyle(color: AppColors.danger)))
            else
              ..._users.map(
                (u) => Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    title: Text(u.username),
                    subtitle: Text(u.isAdmin ? 'Admin' : 'Viewer'),
                    trailing: IconButton(
                      icon: const Icon(Icons.delete_outline, color: AppColors.danger),
                      onPressed: () => _deleteUser(u),
                    ),
                  ),
                ),
              ),
          ],
          const SizedBox(height: 28),
          OutlinedButton.icon(
            onPressed: _logout,
            icon: const Icon(Icons.logout, color: AppColors.danger),
            label: const Text('Keluar', style: TextStyle(color: AppColors.danger)),
            style: OutlinedButton.styleFrom(side: const BorderSide(color: AppColors.danger)),
          ),
        ],
      ),
    );
  }
}
