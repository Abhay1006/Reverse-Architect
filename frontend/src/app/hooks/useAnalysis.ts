// ============================================================
//  React Query hooks for Atlas analysis API
//  Replaces raw fetch() calls with cached, retry-enabled mutations.
//
//  These hooks own the *whole* analysis lifecycle — progress stream,
//  store update, loading flag — so every entry point (landing page,
//  upload dialog) behaves identically. Calling analyzeGithub/analyzeUpload
//  directly from a component is what caused repoId to be dropped on the
//  landing-page flow and progress to be missing on the upload flow.
// ============================================================

import { useMutation } from "@tanstack/react-query";
import {
  analyzeUpload,
  analyzeGithub,
  toStoreGraph,
  AtlasApiError,
  type ReactFlowGraph,
} from "../lib/atlas-api";
import { useAtlasStore } from "../store/atlas-store";

function generateSessionId(): string {
  // crypto.randomUUID is available in every browser Next 16 targets.
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

/**
 * Open an SSE progress stream for a session and pipe messages into the store.
 * Returns a closer that is safe to call more than once.
 */
function openProgressStream(sessionId: string, onMessage: (text: string) => void): () => void {
  let source: EventSource | null = null;
  try {
    source = new EventSource(`/api/analyze/progress?sessionId=${encodeURIComponent(sessionId)}`);
  } catch {
    return () => {};
  }

  const es = source;
  es.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data);
      if (event.message) onMessage(event.message);
      if (event.step === "done" || event.step === "error") es.close();
    } catch {
      // A malformed progress frame must never break the analysis itself.
    }
  };
  // Network hiccups on the progress channel are not fatal — close and move on.
  es.onerror = () => es.close();

  return () => es.close();
}

/**
 * Shared driver for both analysis flows: start progress, run the request,
 * push the full result into the store, and always tear the stream down.
 */
function useAnalysisMutation<TInput>(
  run: (input: TInput, sessionId: string) => Promise<ReactFlowGraph>,
) {
  const setGraph = useAtlasStore((s) => s.setGraph);
  const setIsLoading = useAtlasStore((s) => s.setIsLoading);
  const setProgressText = useAtlasStore((s) => s.setProgressText);

  return useMutation({
    mutationFn: async (input: TInput) => {
      const sessionId = generateSessionId();
      setIsLoading(true);
      setProgressText("Initializing...");
      const closeStream = openProgressStream(sessionId, setProgressText);
      try {
        return await run(input, sessionId);
      } finally {
        closeStream();
      }
    },
    // Spread the whole payload — including repoId, which Code Peek and the
    // AI assistant both depend on.
    onSuccess: (graph) => setGraph(toStoreGraph(graph)),
    onSettled: () => {
      setIsLoading(false);
      setProgressText("");
    },
  });
}

/** Mutation hook for uploading a .zip file for analysis. */
export function useUploadAnalysis() {
  return useAnalysisMutation<File>((file, sessionId) => analyzeUpload(file, sessionId));
}

/** Mutation hook for analyzing a GitHub repository URL. */
export function useGithubAnalysis() {
  return useAnalysisMutation<string>((url, sessionId) => analyzeGithub(url, sessionId));
}

/**
 * Helper to extract a user-friendly error message from mutation errors.
 */
export function getAnalysisErrorMessage(error: unknown): string {
  if (error instanceof AtlasApiError) {
    return error.details
      ? `${error.message}: ${error.details}`
      : error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "An unexpected error occurred during analysis.";
}
