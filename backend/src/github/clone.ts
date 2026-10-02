import { simpleGit } from 'simple-git';
import { buildChildEnv } from '../child-env.js';

/**
 * Build the minimal environment git needs, plus our own safety settings.
 *
 * This is an allow-list rather than `{ ...process.env }` for two reasons:
 *
 *  1. simple-git refuses to spawn when the environment contains a variable
 *     that would make git execute an arbitrary command — GIT_EDITOR, PAGER,
 *     GIT_ASKPASS, GIT_SSH_COMMAND and friends. Those are commonly set in a
 *     developer's shell, and inheriting them made every clone fail with
 *     `Use of "X" is not permitted without enabling allowUnsafeX`.
 *  2. A server has no business forwarding its whole ambient environment into
 *     a subprocess that checks out untrusted code.
 */
export function buildGitEnv(): Record<string, string> {
  const env = buildChildEnv([
    // TLS trust stores
    'GIT_SSL_CAINFO', 'GIT_SSL_CAPATH', 'SSL_CERT_FILE', 'SSL_CERT_DIR',
  ]);

  // Never block on an interactive credential prompt — fail the clone instead.
  // This replaces the old GIT_ASKPASS='true', which simple-git rejects.
  env.GIT_TERMINAL_PROMPT = '0';

  return env;
}

/**
 * git `-c` arguments that authenticate against GitHub with GITHUB_TOKEN.
 *
 * The token travels as an HTTP header rather than in the remote URL. A
 * URL-embedded token is written verbatim into the clone's .git/config and
 * shows up in git's error output, which this server forwards to clients.
 * Returns an empty list when no token is configured or the URL is not HTTPS.
 */
export function githubAuthConfig(url: string): string[] {
  const token = process.env.GITHUB_TOKEN;
  if (!token || !url.startsWith('https://')) return [];
  // git's http.extraHeader accepts a Basic credential; GitHub treats the
  // token as the username with an empty password.
  const basic = Buffer.from(`x-access-token:${token}`).toString('base64');
  return [`http.extraHeader=Authorization: Basic ${basic}`];
}

/**
 * Clones a GitHub repository to a target directory using simple-git.
 * Supports private repositories via `GITHUB_TOKEN` (see githubAuthConfig).
 *
 * @param url The GitHub repository URL.
 * @param targetDir The absolute path where the repo should be cloned.
 */
export async function cloneRepo(url: string, targetDir: string): Promise<void> {
  const git = simpleGit({ config: githubAuthConfig(url) }).env(buildGitEnv());

  // Clone with depth 1 to speed up analysis and reduce disk usage
  await git.clone(url, targetDir, {
    '--depth': 1,
    '--single-branch': null, // ONLY fetch the default branch history
  });
}
