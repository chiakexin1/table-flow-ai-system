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
   Primary health / connectivity check.
   Calls Ollama’s `/api/tags` endpoint to verify the daemon is up
   and optionally confirm the requested model is installed.
   ------------------------------------------------------------------ */
export async function checkOllamaConnection(): Promise<OllamaConnectionResult> {
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

    // ----------------------------------------------------------------
    // Model verification (if a model name was supplied)
    // ----------------------------------------------------------------
    if (!OLLAMA_MODEL) {
      return {
        status: "model_not_configured",
        details: "VITE_OLLAMA_MODEL is missing or empty",
      };
    }

    const modelExists = parseResult.data.models.some(
      (m) => m.name === OLLAMA_MODEL,
    );

    if (!modelExists) {
      return {
        status: "model_not_found",
        details: `Model "${OLLAMA_MODEL}" not installed on this Ollama instance`,
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
   Exported configuration constants – useful for later AI‑advisor code.
   ------------------------------------------------------------------ */
export const ollamaConfig = {
  baseUrl: OLLAMA_BASE_URL,
  model: OLLAMA_MODEL,
};