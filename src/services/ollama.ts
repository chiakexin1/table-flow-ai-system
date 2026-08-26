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
   Typed result of a connectivity/health check.
   ------------------------------------------------------------------ */
export type OllamaConnectionStatus =
  | "connected"
  | "offline"
  | "timeout"
  | "model_not_configured"
  | "model_not_found";

export interface OllamaConnectionResult {
  /** One of the status strings above */
  status: OllamaConnectionStatus;
  /** Optional human‑readable details for logging or UI */
  details?: string;
}

/* ------------------------------------------------------------------
   Helper – AbortController timeout wrapper around fetch.
   ------------------------------------------------------------------ */
async function fetchWithTimeout(
  input: RequestInfo,
  init: RequestInit = {},
  timeoutMs = 5_000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------
   Retrieve the list of installed Ollama models.
   Returns an array of model names (empty array on error or no models).
   ------------------------------------------------------------------ */
export async function listOllamaModels(): Promise<string[]> {
  const tagsUrl = `${OLLAMA_BASE_URL.replace(/\/+$/, "")}/api/tags`;

  try {
    const resp = await fetchWithTimeout(tagsUrl, { method: "GET" });

    if (!resp.ok) {
      // Unexpected HTTP status → treat as no models available
      console.error("[ollama] tags request failed:", resp.status);
      return [];
    }

    const json = await resp.json();

    const schema = z.object({
      models: z.array(z.object({ name: z.string() })),
    });

    const parseResult = schema.safeParse(json);
    if (!parseResult.success) {
      console.error("[ollama] unexpected tags response format");
      return [];
    }

    return parseResult.data.models.map((m) => m.name);
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.error("[ollama] tags request timed out");
    } else {
      console.error("[ollama] tags request error:", err);
    }
    return [];
  }
}

/* ------------------------------------------------------------------
   Primary health / connectivity check.
   Optionally accepts a runtime model name to verify.
   ------------------------------------------------------------------ */
export async function checkOllamaConnection(
  selectedModel?: string,
): Promise<OllamaConnectionResult> {
  const tagsUrl = `${OLLAMA_BASE_URL.replace(/\/+$/, "")}/api/tags`;

  try {
    const resp = await fetchWithTimeout(tagsUrl, { method: "GET" });

    if (!resp.ok) {
      // Ollama answered but with a non‑200 status → treat as offline
      return {
        status: "offline",
        details: `HTTP ${resp.status}`,
      };
    }

    const json = await resp.json();

    // Expected shape: { models: [{ name: string, … }, …] }
    const schema = z.object({
      models: z.array(z.object({ name: z.string() })),
    });

    const parseResult = schema.safeParse(json);
    if (!parseResult.success) {
      return {
        status: "offline",
        details: "Unexpected response format from Ollama",
      };
    }

    const availableModels = parseResult.data.models.map((m) => m.name);

    // ----------------------------------------------------------------
    // Determine which model we should validate against.
    // ----------------------------------------------------------------
    const modelToValidate =
      selectedModel !== undefined
        ? selectedModel
        : OLLAMA_MODEL; // fallback to env variable when no explicit selection

    // No model supplied → configuration missing.
    if (!modelToValidate) {
      return {
        status: "model_not_configured",
        details: "No model supplied (env or UI selection)",
      };
    }

    // Verify the model exists in the list returned by Ollama.
    const found = availableModels.includes(modelToValidate);

    if (!found) {
      return {
        status: "model_not_found",
        details: `Model "${modelToValidate}" not installed on this Ollama instance`,
      };
    }

    // All checks passed
    return { status: "connected" };
  } catch (err: any) {
    if (err.name === "AbortError") {
      return {
        status: "timeout",
        details: "Health request timed out after 5 seconds",
      };
    }
    // Network‑level failure (connection refused, DNS, etc.)
    return {
      status: "offline",
      details: err.message ?? "Unknown network error",
    };
  }
}

/* ------------------------------------------------------------------
   Streamed chat generation against Ollama.
   Sends a POST /api/chat with `stream: true` and calls `onChunk`
   for each piece of assistant content received.
   AbortController can be supplied to cancel the request.
   ------------------------------------------------------------------ */
export async function streamChat(
  /** Messages for the Ollama chat – must include a system message first */
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  /** Model name to use – must be installed */
  model: string,
  /** Called for every piece of assistant content received */
  onChunk: (chunk: string) => void,
  /** Optional abort controller to cancel streaming */
  abortController?: AbortController,
): Promise<void> {
  const endpoint = `${OLLAMA_BASE_URL.replace(/\/+$/, "")}/api/chat`;

  const payload = {
    model,
    messages,
    stream: true,
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: abortController?.signal,
  });

  if (!response.ok) {
    const txt = await response.text();
    throw new Error(
      `Ollama chat request failed (${response.status}): ${txt}`,
    );
  }

  // Ollama streams NDJSON lines: `data: {...}`\n\n
  const decoder = new TextDecoder();
  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error("Unable to read streaming response from Ollama");
  }

  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Process each line that ends with a newline
    let lineEnd: number;
    while ((lineEnd = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, lineEnd).trim();
      buffer = buffer.slice(lineEnd + 1);

      if (!line) continue; // skip empty lines
      if (line === "data: [DONE]") {
        // Stream finished
        return;
      }

      // Expected format: data: {"message":{"role":"assistant","content":"..."}}
      if (line.startsWith("data:")) {
        const jsonPart = line.replace(/^data:\s*/, "");
        try {
          const parsed = JSON.parse(jsonPart);
          const content = parsed?.message?.content;
          if (typeof content === "string") {
            onChunk(content);
          }
        } catch {
          // If parsing fails just ignore the line – it’s non‑critical.
        }
      }
    }
  }
}

/* ------------------------------------------------------------------
   Exported configuration constants – useful for later AI‑advisor code.
   ------------------------------------------------------------------ */
export const ollamaConfig = {
  baseUrl: OLLAMA_BASE_URL,
  model: OLLAMA_MODEL,
};