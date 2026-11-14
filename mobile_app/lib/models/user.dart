class AppUser {
  AppUser({required this.id, required this.username, required this.role});

  final int id;
  final String username;
  final String role;

  bool get isAdmin => role == 'admin';

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
        id: json['id'] as int,
        username: json['username'] as String,
        role: json['role'] as String,
      );
}
