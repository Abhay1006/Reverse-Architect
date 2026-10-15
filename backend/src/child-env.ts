// ============================================================
//  Atlas — Child Process Environment
//  Subprocesses (git, the language server) work on untrusted,
//  cloned code, so they get an allow-listed environment rather
//  than everything this server was started with (GITHUB_TOKEN,
//  API keys, deploy secrets...).
// ============================================================

/** Variables every child process needs to run at all. */
const BASE_ALLOWLIST = [
  // Android/Termux: libtermux-exec.so is LD_PRELOAD-ed so that execve()
  // works on binaries under $PREFIX. Without it a child cannot exec its own
  // helpers, e.g. git fails with `cannot exec 'remote-https': Permission denied`.
  'LD_PRELOAD',
  'PATH',
  'HOME',
  'TMPDIR', 'TMP', 'TEMP',
  'LANG',
  'LC_ALL',
  // Windows
  'SystemRoot',
  'SYSTEMROOT',
  'USERPROFILE',
  'APPDATA',
  'LOCALAPPDATA',
  // Proxies
  'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY',
  'http_proxy', 'https_proxy', 'no_proxy',
] as const;

/**
 * Copy the allow-listed variables (plus `extra`) from process.env.
 * Variables that are not set are omitted.
 */
export function buildChildEnv(extra: readonly string[] = []): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of [...BASE_ALLOWLIST, ...extra]) {
    const value = process.env[key];
    if (value !== undefined) env[key] = value;
  }
  return env;
}
