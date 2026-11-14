class AppUser {
  AppUser({required this.id, required this.username, required this.role});

  final int id;
  final String username;
  final String role;

  bool get isAdmin => role == 'admin';

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
        id: (json['id'] as num?)?.toInt() ?? 0,
        username: json['username'] as String? ?? '',
        role: json['role'] as String? ?? 'viewer',
      );
}
