import { execFileSync } from 'child_process';
import { buildGitEnv } from '../github/clone.js';

/**
 * Gets the latest commit SHA for a remote Git repository without cloning it.
 * Uses git ls-remote to query the default branch (usually main or master).
 */
export function getRemoteCommitSha(repoUrl: string): string | null {
  try {
    // git ls-remote returns output like: 
    // <sha>	HEAD
    // <sha>	refs/heads/main
    const output = execFileSync('git', ['ls-remote', repoUrl, 'HEAD'], { 
      encoding: 'utf8', 
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 10000, // 10 seconds timeout to prevent blocking the event loop
      // Same minimal environment as the clone path — see buildGitEnv.
      env: buildGitEnv()
    });
    
    if (!output) return null;
    
    // Extract the SHA (first column)
    const match = output.trim().match(/^([a-f0-9]{40})\s+HEAD$/);
    return match ? match[1] || null : null;
  } catch (error) {
    console.warn(`Failed to get remote commit SHA for ${repoUrl}:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}
