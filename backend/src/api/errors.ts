// ============================================================
//  Atlas — Error sanitization
//  Analysis errors are surfaced to the client (they carry useful
//  messages like "repository is too large"), so they must never
//  carry credentials with them.
// ============================================================

/** Matches credentials embedded in a URL: https://user:token@host or https://token@host */
const URL_CREDENTIALS_RE = /(https?:\/\/)[^/\s@]+@/gi;

/**
 * Remove anything secret-shaped from a string before it leaves the process.
 *
 * Covers the two ways a token can leak from git: embedded in a remote URL
 * (`https://<token>@github.com/...`), and echoed verbatim from the environment.
 */
export function scrubSecrets(input: string): string {
  let out = input.replace(URL_CREDENTIALS_RE, '$1***@');

  const token = process.env.GITHUB_TOKEN;
  if (token && token.length >= 8) {
    out = out.split(token).join('***');
  }
  return out;
}

/** Extract a safe, client-facing message from an unknown thrown value. */
export function toClientError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return scrubSecrets(raw);
}
