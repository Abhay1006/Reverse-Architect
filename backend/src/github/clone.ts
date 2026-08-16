import { simpleGit } from 'simple-git';

/**
 * Clones a GitHub repository to a target directory using simple-git.
 * Supports private repositories via an environment variable `GITHUB_TOKEN`.
 *
 * The token is passed as an HTTP header rather than embedded in the remote
 * URL. A URL-embedded token is written verbatim into the clone's .git/config
 * and shows up in git's error output, which this server forwards to clients.
 *
 * @param url The GitHub repository URL.
 * @param targetDir The absolute path where the repo should be cloned.
 */
export async function cloneRepo(url: string, targetDir: string): Promise<void> {
  const token = process.env.GITHUB_TOKEN;

  const configArgs: string[] = [];
  if (token && url.startsWith('https://')) {
    // git's http.extraHeader accepts a Basic credential; GitHub treats the
    // token as the username with an empty password.
    const basic = Buffer.from(`x-access-token:${token}`).toString('base64');
    configArgs.push(`http.extraHeader=Authorization: Basic ${basic}`);
  }

  const git = simpleGit({ config: configArgs }).env({
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
    GIT_ASKPASS: 'true',
  });

  // Clone with depth 1 to speed up analysis and reduce disk usage
  await git.clone(url, targetDir, {
    '--depth': 1,
    '--single-branch': null, // ONLY fetch the default branch history
  });
}
