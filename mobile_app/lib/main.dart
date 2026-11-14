import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api/api_client.dart';
import 'api/auth_service.dart';
import 'models/user.dart';
import 'screens/account_screen.dart';
import 'screens/data_screen.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'screens/peringatan_screen.dart';
import 'screens/settings_screen.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();
  final savedBaseUrl = prefs.getString('base_url');
  await ApiClient.instance(baseUrl: savedBaseUrl);
  runApp(const EcoSenseApp());
}

class EcoSenseApp extends StatelessWidget {
  const EcoSenseApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'EcoSense Station',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      home: const AuthGate(),
    );
  }
}

class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  AppUser? _user;
  bool _checking = true;

  @override
  void initState() {
    super.initState();
    _check();
  }

  Future<void> _check() async {
    try {
      final client = await ApiClient.instance();
      final user = await AuthService(client).currentUser();
      if (!mounted) return;
      setState(() {
        _user = user;
        _checking = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _checking = false);
    }
  }

  void _onLoggedIn(AppUser user) => setState(() => _user = user);
  void _onLoggedOut() => setState(() => _user = null);

  @override
  Widget build(BuildContext context) {
    if (_checking) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_user == null) {
      return LoginScreen(onLoggedIn: _onLoggedIn);
    }
    return MainShell(currentUser: _user!, onLoggedOut: _onLoggedOut);
  }
}

class MainShell extends StatefulWidget {
  const MainShell({super.key, required this.currentUser, required this.onLoggedOut});

  final AppUser currentUser;
  final VoidCallback onLoggedOut;

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final screens = [
      const HomeScreen(),
      const DataScreen(),
      PeringatanScreen(currentUser: widget.currentUser),
      AccountScreen(currentUser: widget.currentUser, onLoggedOut: widget.onLoggedOut),
      const SettingsScreen(),
    ];

    return Scaffold(
      body: IndexedStack(index: _index, children: screens),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.show_chart_outlined), selectedIcon: Icon(Icons.show_chart), label: 'Data'),
          NavigationDestination(
            icon: Icon(Icons.notifications_outlined),
            selectedIcon: Icon(Icons.notifications),
            label: 'Peringatan',
          ),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Account'),
          NavigationDestination(icon: Icon(Icons.settings_outlined), selectedIcon: Icon(Icons.settings), label: 'Settings'),
        ],
      ),
    );
  }
}
