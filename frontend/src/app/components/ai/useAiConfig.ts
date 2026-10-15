import { useState } from "react";
import { clearAiCredentials, loadAiCredentials, saveAiCredentials } from "./streamAi";
import type { AiProvider } from "./types";

/** Saved credentials, or null outside the browser. */
function initialCredentials() {
  return typeof window === "undefined" ? null : loadAiCredentials();
}

/**
 * API key + provider, kept only in sessionStorage for this browser tab.
 * State is read from storage on first render (the assistant tab only ever
 * renders on the client, after a graph is loaded).
 */
export function useAiConfig() {
  const [apiKey, setApiKey] = useState<string>(() => initialCredentials()?.apiKey ?? "");
  const [provider, setProvider] = useState<AiProvider>(() => (initialCredentials()?.provider as AiProvider) ?? "openai");
  const [isConfigured, setIsConfigured] = useState<boolean>(() => initialCredentials() !== null);

  const save = () => {
    if (!apiKey.trim()) return;
    saveAiCredentials(apiKey.trim(), provider);
    setIsConfigured(true);
  };

  const disconnect = () => {
    clearAiCredentials();
    setApiKey("");
    setIsConfigured(false);
  };

  return { apiKey, setApiKey, provider, setProvider, isConfigured, save, disconnect };
}
