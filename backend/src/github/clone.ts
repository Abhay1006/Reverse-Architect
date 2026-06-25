import { simpleGit } from 'simple-git';

/**
 * Clones a GitHub repository to a target directory using simple-git.
 * Supports private repositories via an environment variable `GITHUB_TOKEN`.
 *
 * @param url The GitHub repository URL.
 * @param targetDir The absolute path where the repo should be cloned.
 */
export async function cloneRepo(url: string, targetDir: string): Promise<void> {
  const git = simpleGit({
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: 'true' }
  });

  // If GITHUB_TOKEN is present, inject it into the clone URL for private repos
  let cloneUrl = url;
  const token = process.env.GITHUB_TOKEN;
  
  if (token && (url.startsWith('https://') || url.startsWith('http://'))) {
    // Prevent double injection if URL already has auth
    if (!url.includes('@')) {
      const protocol = url.startsWith('https://') ? 'https://' : 'http://';
      cloneUrl = url.replace(protocol, `${protocol}${token}@`);
    }
  }

  // Clone with depth 1 to speed up analysis and reduce disk usage
  await git.clone(cloneUrl, targetDir, {
    '--depth': 1,
    '--single-branch': null // ONLY fetch the default branch history
  });
}
