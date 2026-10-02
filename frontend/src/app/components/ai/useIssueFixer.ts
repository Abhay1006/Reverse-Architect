import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { streamAi } from "./streamAi";
import { isUploadRepo, type GitHubIssue } from "./types";

/**
 * Open GitHub issues for the active repository, and the AI fix suggestion for
 * the selected one. Issues load when `active` becomes true.
 */
export function useIssueFixer(repoId: string | null, repoUrl: string, active: boolean) {
  const [selectedIssue, setSelectedIssue] = useState<GitHubIssue | null>(null);
  const [fixSuggestion, setFixSuggestion] = useState<string>("");
  const [isFixLoading, setIsFixLoading] = useState<boolean>(false);

  // Fetch the repository's open GitHub issues once the issues tab is open.
  const issuesQuery = useQuery({
    queryKey: ["github-issues", repoUrl],
    enabled: active && Boolean(repoId) && !isUploadRepo(repoId),
    retry: false,
    queryFn: async ({ signal }): Promise<GitHubIssue[]> => {
      const res = await fetch(`/api/ai/issues?repoUrl=${encodeURIComponent(repoUrl)}`, { signal });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.details || body.error || "Failed to fetch repository issues");
      }
      const data = await res.json();
      return data.issues || [];
    },
  });

  const issues = issuesQuery.data ?? [];
  const areIssuesLoading = issuesQuery.isFetching;
  const issuesError = issuesQuery.error
    ? issuesQuery.error instanceof Error ? issuesQuery.error.message : "Could not retrieve open issues."
    : null;
  const fetchIssues = async () => {
    await issuesQuery.refetch();
  };

  const fixIssue = async (issue: GitHubIssue) => {
    setFixSuggestion("");
    setIsFixLoading(true);

    await streamAi(
      "/api/ai/fix-issue",
      {
        issue: { number: issue.number, title: issue.title, body: issue.body },
        repoUrl,
      },
      {
        onChunk: (chunk) => setFixSuggestion((prev) => prev + chunk),
        onDone: () => setIsFixLoading(false),
        onError: (err) => {
          setFixSuggestion((prev) => prev + `\n\n❌ Error: ${err.message}`);
          setIsFixLoading(false);
        },
      },
    );
  };

  const reset = () => {
    setSelectedIssue(null);
    setFixSuggestion("");
  };

  return {
    issues,
    areIssuesLoading,
    issuesError,
    fetchIssues,
    selectedIssue,
    setSelectedIssue,
    fixSuggestion,
    isFixLoading,
    fixIssue,
    reset,
  };
}
