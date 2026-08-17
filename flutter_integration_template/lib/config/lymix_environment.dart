class LymixEnvironment {
  const LymixEnvironment._();

  static const String apiBase = String.fromEnvironment(
    'LYMIX_API_BASE',
    defaultValue: '',
  );

  static String requireApiBase() {
    final value = apiBase.trim();
    if (value.isEmpty) {
      throw StateError(
        'LYMIX_API_BASE tanımlı değil. --dart-define=LYMIX_API_BASE=https://... kullanın.',
      );
    }
    return value.endsWith('/') ? value.substring(0, value.length - 1) : value;
  }
}
