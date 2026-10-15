export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: string;
  created_at: string;
  labels: Array<{ name: string; color: string }>;
  user: {
    login: string;
    avatar_url: string;
  };
}

export type AiProvider = "openai" | "anthropic" | "gemini";

/** Uploaded projects have no GitHub repository behind them. */
export function isUploadRepo(repoId: string | null | undefined): boolean {
  return Boolean(repoId?.startsWith("upload-"));
}

/** The repoUrl the AI endpoints expect for the active repository. */
export function repoUrlFor(repoId: string | null | undefined): string {
  if (!repoId) return "";
  return isUploadRepo(repoId) ? `local://${repoId}` : `https://github.com/${repoId}`;
}
