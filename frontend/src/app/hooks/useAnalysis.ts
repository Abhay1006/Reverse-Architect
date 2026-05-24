// ============================================================
//  React Query hooks for Atlas analysis API
//  Replaces raw fetch() calls with cached, retry-enabled mutations
// ============================================================

import { useMutation } from "@tanstack/react-query";
import {
  analyzeUpload,
  analyzeGithub,
  toStoreGraph,
  AtlasApiError,
} from "../lib/atlas-api";
import { useAtlasStore } from "../store/atlas-store";

/**
 * Mutation hook for uploading a .zip file for analysis.
 * Automatically updates the Zustand store on success.
 */
export function useUploadAnalysis() {
  const setGraph = useAtlasStore((s) => s.setGraph);

  return useMutation({
    mutationFn: (file: File) => analyzeUpload(file),
    onSuccess: (graph) => {
      const {
        nodes,
        edges,
        analysis,
        godObjectDetails,
        deadCodeDetails,
        entryPoint,
        repoId,
      } = toStoreGraph(graph);
      setGraph(
        nodes,
        edges,
        analysis,
        godObjectDetails,
        deadCodeDetails,
        entryPoint,
        repoId
      );
    },
  });
}

/**
 * Mutation hook for analyzing a GitHub repository URL.
 * Automatically updates the Zustand store on success.
 */
export function useGithubAnalysis() {
  const setGraph = useAtlasStore((s) => s.setGraph);

  return useMutation({
    mutationFn: (url: string) => analyzeGithub(url),
    onSuccess: (graph) => {
      const {
        nodes,
        edges,
        analysis,
        godObjectDetails,
        deadCodeDetails,
        entryPoint,
        repoId,
      } = toStoreGraph(graph);
      setGraph(
        nodes,
        edges,
        analysis,
        godObjectDetails,
        deadCodeDetails,
        entryPoint,
        repoId
      );
    },
  });
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
