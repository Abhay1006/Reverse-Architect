import { Router } from 'express';
import type { Request, Response } from 'express';
import { CacheManager } from '../cache/cache-manager.js';
import { buildRepoContext, findAndLoadRelevantFiles } from './context-builder.js';
import { handleAIStream } from './ai-providers.js';
import type { ChatMessage } from './ai-providers.js';
import { isValidRepoId } from '../api/path-safety.js';
import { toClientError } from '../api/errors.js';

export const aiRouter = Router();

/** Providers we know how to stream from. */
const SUPPORTED_PROVIDERS = new Set(['openai', 'anthropic', 'gemini']);

/** The subset of the GitHub issues API response that we consume. */
interface GitHubApiIssue {
  number: number;
  title: string;
  body: string | null;
  state: string;
  created_at: string;
  pull_request?: unknown;
  labels?: { name: string; color: string }[];
  user?: { login: string; avatar_url: string };
}

/**
 * Derive a repo id from a client-supplied URL.
 *
 * Returns null unless the result is a well-formed `owner/repo` (or upload id).
 * This value is used to build filesystem paths, so an unvalidated value here
 * is a directory-traversal read of anything on disk.
 */
function getRepoId(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  const id = url
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//, '')
    .replace(/^local:\/\//, '')
    .replace(/\/$/, '');
  return isValidRepoId(id) ? id : null;
}

/**
 * Validate the shared preconditions of the streaming endpoints.
 * Writes the error response itself and returns null when invalid.
 */
function requireCredentials(req: Request, res: Response): { apiKey: string; provider: string } | null {
  const apiKey = req.headers['x-ai-api-key'];
  const provider = req.headers['x-ai-provider'];

  if (typeof apiKey !== 'string' || !apiKey || typeof provider !== 'string' || !provider) {
    res.status(400).json({ error: 'Missing x-ai-api-key or x-ai-provider headers' });
    return null;
  }
  if (!SUPPORTED_PROVIDERS.has(provider)) {
    res.status(400).json({ error: `Unsupported AI provider: ${provider}` });
    return null;
  }
  return { apiKey, provider };
}

/**
 * POST /api/ai/chat
 * Stream AI response for general repo Q&A
 */
aiRouter.post('/chat', async (req: Request, res: Response) => {
  const { message, repoUrl, history } = req.body;

  const credentials = requireCredentials(req, res);
  if (!credentials) return;
  const { apiKey, provider } = credentials;

  if (typeof message !== 'string' || !message || !repoUrl) {
    res.status(400).json({ error: 'Missing message or repoUrl' });
    return;
  }
  if (message.length > 32_000) {
    res.status(413).json({ error: 'Message is too long' });
    return;
  }

  const repoId = getRepoId(repoUrl);
  if (!repoId) {
    res.status(400).json({ error: 'Invalid repoUrl' });
    return;
  }

  try {
    const graph = CacheManager.getCachedResult(repoId);
    
    // Build context from graph structure and relevant source code
    const repoContext = buildRepoContext(repoId, graph);
    const codeContext = findAndLoadRelevantFiles(repoId, message);

    const systemPrompt = `You are a senior software architect and AI developer assistant. You are helping a developer understand a codebase called "${repoId}".
Here is the structural and architectural outline of the repository:
${repoContext}
${codeContext ? `\nHere is the actual source code of the relevant file(s) mentioned in your conversation:\n${codeContext}` : ''}
Use the above information to answer the user's questions about how components interact, where features are located, how dependencies are laid out, and general architectural structure. Be concise, precise, and practical.`;

    // Map history to standard ChatMessage format
    const messages: ChatMessage[] = [];
    if (Array.isArray(history)) {
      // Keep only the most recent turns so a client cannot grow the prompt
      // without bound.
      history.slice(-20).forEach((h: unknown) => {
        if (!h || typeof h !== 'object') return;
        const { role, content } = h as { role?: unknown; content?: unknown };
        if ((role === 'user' || role === 'assistant') && typeof content === 'string') {
          messages.push({ role, content });
        }
      });
    }
    messages.push({ role: 'user', content: message });

    await handleAIStream({
      provider,
      apiKey,
      messages,
      systemPrompt
    }, res);

  } catch (err: unknown) {
    console.error('[/api/ai/chat] Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to complete Q&A chat request', details: toClientError(err) });
    } else {
      res.end();
    }
  }
});

/**
 * POST /api/ai/fix-issue
 * Stream AI response suggesting a fix for a GitHub issue
 */
aiRouter.post('/fix-issue', async (req: Request, res: Response) => {
  const { issue, repoUrl } = req.body;

  const credentials = requireCredentials(req, res);
  if (!credentials) return;
  const { apiKey, provider } = credentials;

  if (!issue || typeof issue !== 'object' || !repoUrl) {
    res.status(400).json({ error: 'Missing issue or repoUrl' });
    return;
  }

  const repoId = getRepoId(repoUrl);
  if (!repoId) {
    res.status(400).json({ error: 'Invalid repoUrl' });
    return;
  }

  try {
    const graph = CacheManager.getCachedResult(repoId);
    
    // Build context
    const repoContext = buildRepoContext(repoId, graph);
    // Find relevant files mentioned in issue title/body
    const issueSearchText = `${issue.title} ${issue.body || ''}`;
    const codeContext = findAndLoadRelevantFiles(repoId, issueSearchText);

    const systemPrompt = `You are a senior software engineer helping to resolve a public GitHub issue for the codebase "${repoId}".
Here is the architectural context of the repository:
${repoContext}
${codeContext ? `\nHere is the actual source code of relevant file(s):\n${codeContext}` : ''}

The developer wants to fix the following GitHub issue:
Number: #${issue.number}
Title: ${issue.title}
Description:
${issue.body || 'No description provided.'}

Please analyze this issue in the context of the repository structure.
Identify which files likely need to be modified, outline the logic changes required, and provide code suggestions or diffs where appropriate. Be extremely detailed, precise, and practical in your suggestions.`;

    const messages: ChatMessage[] = [
      { role: 'user', content: `Please provide a detailed guide and code changes to fix GitHub issue #${issue.number}: "${issue.title}".` }
    ];

    await handleAIStream({
      provider,
      apiKey,
      messages,
      systemPrompt
    }, res);

  } catch (err: unknown) {
    console.error('[/api/ai/fix-issue] Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to suggest issue fix', details: toClientError(err) });
    } else {
      res.end();
    }
  }
});

/**
 * GET /api/ai/issues
 * Fetch open issues from a public GitHub repo
 */
aiRouter.get('/issues', async (req: Request, res: Response) => {
  const { repoUrl } = req.query;

  if (!repoUrl || typeof repoUrl !== 'string') {
    res.status(400).json({ error: 'Missing repoUrl query parameter' });
    return;
  }

  const repoId = getRepoId(repoUrl);
  if (!repoId) {
    res.status(400).json({ error: 'Invalid repoUrl' });
    return;
  }

  try {
    // Fetch from public GitHub API. repoId is validated as owner/repo above,
    // so it cannot inject extra path segments or query parameters.
    const response = await fetch(`https://api.github.com/repos/${repoId}/issues?state=open&per_page=30`, {
      headers: {
        'User-Agent': 'Reverse-Architect-AI-Assistant',
        'Accept': 'application/vnd.github.v3+json',
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      if (response.status === 404) {
        res.status(404).json({ error: 'Repository not found or has no public issues' });
        return;
      }
      const errText = await response.text();
      throw new Error(`GitHub API error: ${response.status} - ${errText}`);
    }

    const rawIssues = (await response.json()) as GitHubApiIssue[];

    // Map to a clean payload, filtering out pull requests
    const issues = rawIssues
      .filter((issue) => !issue.pull_request)
      .map((issue) => ({
        number: issue.number,
        title: issue.title,
        body: issue.body,
        state: issue.state,
        created_at: issue.created_at,
        labels: (issue.labels ?? []).map((l) => ({
          name: l.name,
          color: l.color,
        })),
        user: {
          login: issue.user?.login,
          avatar_url: issue.user?.avatar_url,
        }
      }));

    res.json({ issues });
  } catch (err: unknown) {
    console.error('[/api/ai/issues] Error:', err);
    res.status(500).json({ error: 'Failed to fetch GitHub issues', details: toClientError(err) });
  }
});
