import type { Response } from 'express';
import { scrubSecrets } from '../api/errors.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamOptions {
  provider: string;
  apiKey: string;
  messages: ChatMessage[];
  systemPrompt?: string;
}

/**
 * Default model per provider. Override with env vars so the pinned ids can be
 * bumped without a code change.
 */
const MODELS = {
  openai: process.env.ATLAS_OPENAI_MODEL ?? 'gpt-4o',
  anthropic: process.env.ATLAS_ANTHROPIC_MODEL ?? 'claude-sonnet-5-5',
  gemini: process.env.ATLAS_GEMINI_MODEL ?? 'gemini-3.5-flash',
} as const;

const MAX_OUTPUT_TOKENS = parseInt(process.env.ATLAS_AI_MAX_TOKENS ?? '8192', 10);

/** Abort a provider request that never starts producing output. */
const PROVIDER_TIMEOUT_MS = parseInt(process.env.ATLAS_AI_TIMEOUT_MS ?? String(2 * 60 * 1000), 10);

export async function handleAIStream(options: StreamOptions, res: Response): Promise<void> {
  const { provider, apiKey, messages, systemPrompt } = options;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendError = (msg: string) => {
    if (res.writableEnded) return;
    res.write(`data: ${JSON.stringify({ error: scrubSecrets(msg) })}\n\n`);
    res.end();
  };

  // If the client disconnects mid-stream, stop pulling from the provider.
  const abortController = new AbortController();
  res.on('close', () => abortController.abort());
  const signal = AbortSignal.any([
    abortController.signal,
    AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  ]);

  try {
    if (provider === 'openai') {
      const openAiMessages: ChatMessage[] = [];
      if (systemPrompt) {
        openAiMessages.push({ role: 'system', content: systemPrompt });
      }
      openAiMessages.push(...messages);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MODELS.openai,
          messages: openAiMessages,
          stream: true,
        }),
        signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errText}`);
      }

      await pipeSSEResponse(response, res, (data) => {
        if (data.trim() === '[DONE]') return null;
        try {
          const parsed = JSON.parse(data);
          const text = parsed.choices?.[0]?.delta?.content;
          return text || null;
        } catch {
          return null;
        }
      });

    } else if (provider === 'anthropic') {
      const anthropicMessages = messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }));

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: MODELS.anthropic,
          messages: anthropicMessages,
          system: systemPrompt,
          max_tokens: MAX_OUTPUT_TOKENS,
          stream: true,
        }),
        signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${errText}`);
      }

      await pipeSSEResponse(response, res, (data, event) => {
        if (event === 'content_block_delta') {
          try {
            const parsed = JSON.parse(data);
            if (parsed.delta?.type === 'text_delta') {
              return parsed.delta.text;
            }
          } catch {
            // Not JSON (keep-alive or partial line): skip it.
          }
        }
        return null;
      });

    } else if (provider === 'gemini') {
      const systemInstruction = systemPrompt ? {
        parts: [{ text: systemPrompt }]
      } : undefined;

      const contents = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELS.gemini}:streamGenerateContent?alt=sse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Header rather than a query parameter, so the key cannot end up in
          // proxy or server access logs.
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          systemInstruction,
          contents,
        }),
        signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${errText}`);
      }

      await pipeSSEResponse(response, res, (data) => {
        try {
          const parsed = JSON.parse(data);
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          return text || null;
        } catch {
          return null;
        }
      });

    } else {
      throw new Error(`Unsupported AI provider: ${provider}`);
    }
  } catch (error: unknown) {
    // A client disconnect aborts the fetch — that is not an error worth
    // reporting, and the response is already gone.
    if (error instanceof Error && error.name === 'AbortError') {
      if (!res.writableEnded) res.end();
      return;
    }
    console.error(`Error streaming AI:`, error);
    sendError(error instanceof Error ? error.message : 'Error occurred during AI generation');
  }
}

/**
 * Common SSE stream parsing helper.
 */
async function pipeSSEResponse(
  response: globalThis.Response,
  expressRes: Response,
  dataParser: (data: string, eventName?: string) => string | null
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body is not readable');
  }

  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  // `currentEvent` must live across chunk reads. SSE puts `event:` and `data:`
  // on separate lines, and they routinely arrive in different network chunks —
  // resetting per chunk silently dropped Anthropic's content_block_delta events.
  let currentEvent = '';

  const emit = (data: string) => {
    const textChunk = dataParser(data, currentEvent);
    if (textChunk && !expressRes.writableEnded) {
      expressRes.write(`data: ${JSON.stringify({ text: textChunk })}\n\n`);
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');

      // Save last incomplete line back to buffer
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();

        // A blank line terminates an SSE record — that, not the next data
        // line, is when the event name goes out of scope.
        if (!trimmed) {
          currentEvent = '';
          continue;
        }

        if (trimmed.startsWith('event:')) {
          currentEvent = trimmed.substring(6).trim();
        } else if (trimmed.startsWith('data:')) {
          emit(trimmed.substring(5).trim());
        }
      }
    }

    // Process leftover buffer
    const tail = buffer.trim();
    if (tail.startsWith('data:')) {
      emit(tail.substring(5).trim());
    }

    // Signal end of stream
    if (!expressRes.writableEnded) {
      expressRes.write(`data: [DONE]\n\n`);
      expressRes.end();
    }
  } finally {
    // Always release, including on the success path.
    try {
      reader.releaseLock();
    } catch {
      // Already released.
    }
  }
}
