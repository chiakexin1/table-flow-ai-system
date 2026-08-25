"use client";

import React, { useEffect, useState } from "react";
import Button from "@/components/common/Button";
import {
  checkOllamaConnection,
  ollamaConfig,
  type OllamaConnectionStatus,
  type OllamaConnectionResult,
} from "@/services/ollama";

/* ------------------------------------------------------------------
   UI helper – map internal status to a human‑readable label.
   ------------------------------------------------------------------ */
function statusLabel(
  status: OllamaConnectionStatus | "checking",
): string {
  switch (status) {
    case "checking":
      return "Checking…";
    case "connected":
      return "Connected";
    case "offline":
      return "Offline";
    case "timeout":
      return "Connection timed out";
    case "model_not_configured":
      return "Model not configured";
    case "model_not_found":
      return "Model not found";
    default:
      return "Unknown";
  }
}

/* ------------------------------------------------------------------
   Main Advisor page.
   ------------------------------------------------------------------ */
export default function AIAdvisor() {
  /* ---------- Ollama connection state ---------- */
  const [connectionStatus, setConnectionStatus] = useState<
    OllamaConnectionStatus | "checking"
  >("checking");
  const [connectionDetails, setConnectionDetails] = useState<string | undefined>();

  const runConnectionCheck = async () => {
    setConnectionStatus("checking");
    setConnectionDetails(undefined);
    try {
      const result: OllamaConnectionResult = await checkOllamaConnection();
      setConnectionStatus(result.status);
      if (result.details) setConnectionDetails(result.details);
    } catch (e) {
      // Defensive – any unexpected error is treated as offline.
      setConnectionStatus("offline");
      setConnectionDetails((e as Error).message);
    }
  };

  // Initial check on mount.
  useEffect(() => {
    runConnectionCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Conversation UI state ---------- */
  const [messages, setMessages] = useState<string[]>([]);
  const [input, setInput] = useState("");

  const clearConversation = () => {
    setMessages([]);
    setInput("");
  };

  /* ---------- Quick‑prompt helpers ---------- */
  const quickPrompts = [
    "Analyse today's bookings",
    "How can I reduce no-shows?",
    "Summarise current booking activity",
  ] as const;

  const applyPrompt = (prompt: typeof quickPrompts[number]) => {
    setInput(prompt);
  };

  return (
    <section className="max-w-4xl mx-auto p-6 bg-card rounded-lg shadow">
      {/* ----- Header ----- */}
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">AI Advisor</h1>
        <p className="text-muted-foreground">
          Get AI‑powered operational insights for your restaurant.
        </p>
      </header>

      {/* ----- Ollama connection status panel ----- */}
      <div className="mb-6 p-4 border rounded-md bg-background">
        <div className="flex items-center justify-between">
          <span className="font-medium text-foreground">
            Ollama Service Status:
          </span>
          <span
            className={`font-medium ${
              connectionStatus === "connected"
                ? "text-primary"
                : connectionStatus === "checking"
                ? "text-muted-foreground"
                : "text-destructive"
            }`}
          >
            {statusLabel(connectionStatus)}
          </span>
        </div>

        {/* Show model name when connected */}
        {connectionStatus === "connected" && ollamaConfig.model && (
          <p className="mt-2 text-sm text-foreground">
            Model: <span className="font-medium">{ollamaConfig.model}</span>
          </p>
        )}

        {/* Optional technical details (useful for debugging) */}
        {connectionDetails && (
          <p className="mt-2 text-xs text-muted-foreground">{connectionDetails}</p>
        )}

        <Button
          onClick={runConnectionCheck}
          className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={connectionStatus === "checking"}
        >
          Check Connection
        </Button>
      </div>

      {/* ----- Conversation area ----- */}
      <div className="flex flex-col gap-4">
        {/* Message list (empty state when no messages) */}
        <div className="flex-1 min-h-[200px] p-4 border rounded bg-background overflow-y-auto">
          {messages.length === 0 ? (
            <p className="text-muted-foreground">
              Ask TableFlow AI Advisor about your restaurant operations,
              bookings, no‑shows, or customer enquiries.
            </p>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className="mb-2">
                <p className="text-foreground">{msg}</p>
              </div>
            ))
          )}
        </div>

        {/* Quick‑prompt buttons */}
        <div className="flex flex-wrap gap-2">
          {quickPrompts.map((prompt) => (
            <Button
              key={prompt}
              onClick={() => applyPrompt(prompt)}
              className="bg-muted text-muted-foreground hover:bg-muted/80"
            >
              {prompt}
            </Button>
          ))}
        </div>

        {/* Input & actions */}
        <textarea
          rows={3}
          placeholder="Enter your question here…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full rounded-md border border-input bg-background p-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />

        <div className="flex items-center gap-4">
          {/* Send (disabled) */}
          <Button
            type="button"
            disabled
            className="bg-primary text-primary-foreground opacity-50 cursor-not-allowed"
          >
            Send
          </Button>

          {/* Clear conversation */}
          <Button
            type="button"
            onClick={clearConversation}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Clear Conversation
          </Button>

          {/* Disabled‑state hint */}
          <span className="text-sm text-muted-foreground">
            AI responses will be enabled after context setup.
          </span>
        </div>

        {/* Privacy / context notice */}
        <p className="mt-2 text-xs text-muted-foreground">
          Only relevant restaurant context will be shared with the local AI model
          when you submit a request.
        </p>
      </div>
    </section>
  );
}