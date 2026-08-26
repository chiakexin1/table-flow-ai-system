"use client";

import { z } from "zod";

/* ------------------------------------------------------------------
   Configuration – read from Vite environment variables.
   ------------------------------------------------------------------ */

const OLLAMA_BASE_URL: string =
  (import.meta.env.VITE_OLLAMA_BASE_URL as string) ||
  "http://localhost:11434";

const OLLAMA_MODEL: string =
  (import.meta.env.VITE_OLLAMA_MODEL as string) || "";

/* ------------------------------------------------------------------
   Connectivity / health-check types.
   ------------------------------------------------------------------ */

export type OllamaConnectionStatus =
  | "connected"
  | "offline"
  | "timeout"
  | "model_not_configured"
  | "model_not_found";

export interface OllamaConnectionResult {
  status: OllamaConnectionStatus;
  details?: string;
}

/* ------------------------------------------------------------------
   Chat message type used by Ollama /api/chat.
   ------------------------------------------------------------------ */

export type OllamaChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/* ------------------------------------------------------------------
   Helper – fetch with timeout.
   ------------------------------------------------------------------ */

async function fetchWithTimeout(
  input: RequestInfo,
  init: RequestInit = {},
  timeoutMs = 5_000,
): Promise<Response> {
  const controller = new AbortController();

  const timer = window.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------
   Retrieve installed Ollama models.
   ------------------------------------------------------------------ */

export async function listOllamaModels(): Promise<string[]> {
  const endpoint =
    `${OLLAMA_BASE_URL.replace(/\/+$/, "")}/api/tags`;

  try {
    const response = await fetchWithTimeout(endpoint, {
      method: "GET",
    });

    if (!response.ok) {
      console.error(
        "[ollama] model list request failed:",
        response.status,
      );

      return [];
    }

    const json = await response.json();

    const schema = z.object({
      models: z.array(
        z.object({
          name: z.string(),
        }),
      ),
    });

    const result = schema.safeParse(json);

    if (!result.success) {
      console.error(
        "[ollama] unexpected /api/tags response format",
      );

      return [];
    }

    return result.data.models.map(
      (model) => model.name,
    );
  } catch (error: unknown) {
    if (
      error instanceof DOMException &&
      error.name === "AbortError"
    ) {
      console.error(
        "[ollama] model list request timed out",
      );
    } else {
      console.error(
        "[ollama] model list request failed:",
        error,
      );
    }

    return [];
  }
}

/* ------------------------------------------------------------------
   Check Ollama availability and selected model.
   ------------------------------------------------------------------ */

export async function checkOllamaConnection(
  selectedModel?: string,
): Promise<OllamaConnectionResult> {
  const endpoint =
    `${OLLAMA_BASE_URL.replace(/\/+$/, "")}/api/tags`;

  try {
    const response = await fetchWithTimeout(endpoint, {
      method: "GET",
    });

    if (!response.ok) {
      return {
        status: "offline",
        details: `HTTP ${response.status}`,
      };
    }

    const json = await response.json();

    const schema = z.object({
      models: z.array(
        z.object({
          name: z.string(),
        }),
      ),
    });

    const result = schema.safeParse(json);

    if (!result.success) {
      return {
        status: "offline",
        details:
          "Unexpected response format from Ollama",
      };
    }

    const availableModels =
      result.data.models.map(
        (model) => model.name,
      );

    const modelToValidate =
      selectedModel !== undefined
        ? selectedModel
        : OLLAMA_MODEL;

    if (!modelToValidate) {
      return {
        status: "model_not_configured",
        details:
          "No model supplied by environment or UI selection",
      };
    }

    if (
      !availableModels.includes(modelToValidate)
    ) {
      return {
        status: "model_not_found",
        details:
          `Model "${modelToValidate}" is not installed on this Ollama instance`,
      };
    }

    return {
      status: "connected",
    };
  } catch (error: unknown) {
    if (
      error instanceof DOMException &&
      error.name === "AbortError"
    ) {
      return {
        status: "timeout",
        details:
          "Health request timed out after 5 seconds",
      };
    }

    return {
      status: "offline",
      details:
        error instanceof Error
          ? error.message
          : "Unknown network error",
    };
  }
}

/* ------------------------------------------------------------------
   Stream chat from Ollama /api/chat.

   Ollama normally returns NDJSON when stream=true.

   Example:

   {"message":{"role":"assistant","content":"Hello"},"done":false}
   {"message":{"role":"assistant","content":" there"},"done":false}
   {"message":{"role":"assistant","content":""},"done":true}

   Each assistant content chunk is forwarded through onChunk().
   ------------------------------------------------------------------ */

export async function streamChat(
  messages: OllamaChatMessage[],
  model: string,
  onChunk: (chunk: string) => void,
  abortController?: AbortController,
): Promise<void> {
  const endpoint =
    `${OLLAMA_BASE_URL.replace(/\/+$/, "")}/api/chat`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
    }),
    signal: abortController?.signal,
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Ollama chat request failed (${response.status}): ${
        errorText || response.statusText
      }`,
    );
  }

  if (!response.body) {
    throw new Error(
      "Ollama returned no response stream.",
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");

  let buffer = "";

  try {
    while (true) {
      const { value, done } =
        await reader.read();

      if (done) {
        break;
      }

      /*
        Decode this network chunk.

        A single network chunk may contain:
        - several complete JSON lines
        - one complete line
        - only part of one JSON line

        Therefore we keep incomplete data in `buffer`.
      */
      buffer += decoder.decode(value, {
        stream: true,
      });

      const lines = buffer.split("\n");

      /*
        The last element may be an incomplete JSON
        object, so keep it for the next reader.read().
      */
      buffer = lines.pop() ?? "";

      for (const rawLine of lines) {
        const line = rawLine.trim();

        if (!line) {
          continue;
        }

        parseOllamaStreamLine(
          line,
          onChunk,
        );
      }
    }

    /*
      Flush remaining decoder bytes.
    */
    buffer += decoder.decode();

    const finalLine = buffer.trim();

    if (finalLine) {
      parseOllamaStreamLine(
        finalLine,
        onChunk,
      );
    }
  } finally {
    reader.releaseLock();
  }
}

/* ------------------------------------------------------------------
   Parse one Ollama streamed NDJSON line.

   Also accepts an SSE-style "data:" prefix defensively,
   although standard Ollama /api/chat does not require it.
   ------------------------------------------------------------------ */

function parseOllamaStreamLine(
  rawLine: string,
  onChunk: (chunk: string) => void,
): void {
  let line = rawLine.trim();

  if (!line) {
    return;
  }

  /*
    Defensive compatibility:
    if a proxy ever returns SSE-style data:
    remove the prefix before parsing.
  */
  if (line.startsWith("data:")) {
    line = line
      .replace(/^data:\s*/, "")
      .trim();
  }

  if (
    !line ||
    line === "[DONE]"
  ) {
    return;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(line);
  } catch {
    /*
      Do not crash the complete chat because of
      a malformed/incomplete line.

      Normally incomplete lines are retained in
      `buffer`, so this should be uncommon.
    */
    console.warn(
      "[ollama] unable to parse stream line",
    );

    return;
  }

  const schema = z.object({
    message: z
      .object({
        role: z.string().optional(),
        content: z.string().optional(),
      })
      .optional(),

    response: z.string().optional(),

    done: z.boolean().optional(),

    error: z.string().optional(),
  });

  const result = schema.safeParse(parsed);

  if (!result.success) {
    return;
  }

  if (result.data.error) {
    throw new Error(result.data.error);
  }

  /*
    /api/chat normally stores output under:
      message.content

    `response` fallback is included defensively
    for compatibility with generate-style responses.
  */
  const content =
    result.data.message?.content ??
    result.data.response ??
    "";

  if (content.length > 0) {
    onChunk(content);
  }
}

/* ------------------------------------------------------------------
   Exported configuration.
   ------------------------------------------------------------------ */

export const ollamaConfig = {
  baseUrl: OLLAMA_BASE_URL,
  model: OLLAMA_MODEL,
};