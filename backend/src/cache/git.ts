import { execFile } from 'child_process';
import { promisify } from 'util';
import { buildGitEnv, githubAuthConfig } from '../github/clone.js';
import { scrubSecrets } from '../api/errors.js';

const execFileAsync = promisify(execFile);

/**
 * Gets the latest commit SHA for a remote Git repository without cloning it.
 * Uses git ls-remote to query the default branch (usually main or master).
 *
 * Asynchronous on purpose: the previous execFileSync froze the whole server —
 * health checks, progress streams, AI responses — for up to the timeout on
 * every GitHub analysis request.
 */
export async function getRemoteCommitSha(repoUrl: string): Promise<string | null> {
  // Authenticate the same way the clone does, so private repositories can be
  // freshness-checked (and therefore cached). The header is passed through
  // git's GIT_CONFIG_* environment rather than `-c`, which keeps it out of the
  // process list and out of the "Command failed: ..." error text.
  const env = buildGitEnv();
  const config = githubAuthConfig(repoUrl);
  config.forEach((entry, i) => {
    const eq = entry.indexOf('=');
    env[`GIT_CONFIG_KEY_${i}`] = entry.slice(0, eq);
    env[`GIT_CONFIG_VALUE_${i}`] = entry.slice(eq + 1);
  });
  if (config.length > 0) env.GIT_CONFIG_COUNT = String(config.length);

  try {
    // git ls-remote returns output like:
    // <sha>	HEAD
    const { stdout } = await execFileAsync('git', ['ls-remote', repoUrl, 'HEAD'], {
      encoding: 'utf8',
      timeout: 10_000,
      env,
    });

    const match = stdout.trim().match(/^([a-f0-9]{40})\s+HEAD$/m);
    return match?.[1] ?? null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Failed to get remote commit SHA for ${repoUrl}:`, scrubSecrets(message));
    return null;
  }
}
