// Client for the backend's streaming AI endpoints (SSE frames of
// `{ text }` / `{ error }`, terminated by `[DONE]`).

const KEY_STORAGE = "atlas_ai_key";
const PROVIDER_STORAGE = "atlas_ai_provider";

/** The key and provider the user saved for this browser session. */
export function loadAiCredentials(): { apiKey: string; provider: string } | null {
  const apiKey = sessionStorage.getItem(KEY_STORAGE);
  const provider = sessionStorage.getItem(PROVIDER_STORAGE);
  return apiKey && provider ? { apiKey, provider } : null;
}

export function saveAiCredentials(apiKey: string, provider: string): void {
  sessionStorage.setItem(KEY_STORAGE, apiKey);
  sessionStorage.setItem(PROVIDER_STORAGE, provider);
}

export function clearAiCredentials(): void {
  sessionStorage.removeItem(KEY_STORAGE);
  sessionStorage.removeItem(PROVIDER_STORAGE);
}

export interface StreamHandlers {
  onChunk: (chunk: string) => void;
  onDone: () => void;
  onError: (err: Error) => void;
}

/** POST `body` to a streaming AI endpoint and feed text chunks to `onChunk`. */
export async function streamAi(url: string, body: object, { onChunk, onDone, onError }: StreamHandlers): Promise<void> {
  const credentials = loadAiCredentials();

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ai-api-key": credentials?.apiKey ?? "",
        "x-ai-provider": credentials?.provider ?? "",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({ error: "Unknown connection error" }));
      throw new Error(errJson.details || errJson.error || `HTTP error ${res.status}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("Stream response is not readable");

    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;

        const dataText = trimmed.substring(5).trim();
        if (dataText === "[DONE]") {
          onDone();
          return;
        }
        let parsed: { error?: string; text?: string };
        try {
          parsed = JSON.parse(dataText);
        } catch {
          // Not JSON — ignore this frame rather than aborting the stream.
          continue;
        }
        if (parsed.error) {
          throw new Error(parsed.error);
        }
        if (parsed.text) {
          onChunk(parsed.text);
        }
      }
    }
    onDone();
  } catch (err: unknown) {
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}
