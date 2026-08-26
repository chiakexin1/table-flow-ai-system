"use client";

import React, { useEffect, useRef, useState } from "react";
import Button from "@/components/common/Button";
import {
  checkOllamaConnection,
  listOllamaModels,
  ollamaConfig,
  type OllamaConnectionStatus,
  type OllamaConnectionResult,
  streamChat,
} from "@/services/ollama";
import {
  buildAIAdvisorContext,
  formatAIAdvisorContext,
  type AIAdvisorContext,
} from "@/services/aiContext";
import { useBooking } from "@/context/BookingContext";
import { useAuth } from "@/context/AuthContext";
import { getOrCreateRestaurantForCurrentUser } from "@/services/restaurantService";

/* ------------------------------------------------------------------
   Types for chat messages.
   ------------------------------------------------------------------ */
type AdvisorMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

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
  /* ---------- Auth & Booking state ---------- */
  const { user, loading: authLoading } = useAuth();
  const {
    bookings,
    loading: bookingsLoading,
    error: bookingsError,
  } = useBooking();

  /* ---------- Ollama connection & model state ---------- */
  const [connectionStatus, setConnectionStatus] = useState<
    OllamaConnectionStatus | "checking"
  >("checking");
  const [connectionDetails, setConnectionDetails] = useState<string | undefined>();

  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState<boolean>(true);
  const [selectedModel, setSelectedModel] = useState<string | undefined>();

  const LOCAL_STORAGE_KEY = "selectedOllamaModel";

  /* ---------- Restaurant info for AI context ---------- */
  const [restaurant, setRestaurant] = useState<any>(null);
  const [restaurantLoading, setRestaurantLoading] = useState<boolean>(true);

  /* ---------- AI context building ---------- */
  const [aiContext, setAIContext] = useState<AIAdvisorContext | undefined>();
  const [contextStatus, setContextStatus] = useState<"loading" | "ready" | "unavailable">(
    "loading",
  );
  const [previewOpen, setPreviewOpen] = useState<boolean>(false);

  /* ---------- Conversation state ---------- */
  const [messages, setMessages] = useState<AdvisorMessage[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const abortRef = useRef<AbortController | null>(null);

  /* ---------- Error handling state ---------- */
  const [chatError, setChatError] = useState<boolean>(false); // true when last assistant response failed or was interrupted
  const [lastUserMessage, setLastUserMessage] = useState<AdvisorMessage | null>(null);

  /* ---------- Load models from Ollama ---------- */
  const fetchModels = async () => {
    setModelsLoading(true);
    const models = await listOllamaModels();
    setAvailableModels(models);
    setModelsLoading(false);

    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored && models.includes(stored)) {
      setSelectedModel(stored);
    } else if (ollamaConfig.model && models.includes(ollamaConfig.model)) {
      setSelectedModel(ollamaConfig.model);
    } else if (models.length > 0) {
      setSelectedModel(models[0]);
    }
  };

  /* ---------- Run Ollama health check (optional model) ---------- */
  const runConnectionCheck = async (modelToCheck?: string) => {
    setConnectionStatus("checking");
    setConnectionDetails(undefined);
    try {
      const result: OllamaConnectionResult = await checkOllamaConnection(
        modelToCheck,
      );
      setConnectionStatus(result.status);
      if (result.details) setConnectionDetails(result.details);
    } catch (e) {
      setConnectionStatus("offline");
      setConnectionDetails((e as Error).message);
    }
  };

  /* ---------- Load restaurant for the current authenticated user ---------- */
  const fetchRestaurant = async () => {
    if (!user) {
      setRestaurant(null);
      setRestaurantLoading(false);
      return;
    }
    setRestaurantLoading(true);
    try {
      const rest = await getOrCreateRestaurantForCurrentUser();
      setRestaurant(rest);
    } catch (err) {
      console.error("[AIAdvisor] restaurant fetch error:", err);
      setRestaurant(null);
    } finally {
      setRestaurantLoading(false);
    }
  };

  /* ---------- Build AI context when data becomes ready ---------- */
  const buildContext = async () => {
    if (!restaurant || bookingsLoading || !bookings) {
      setContextStatus("loading");
      setAIContext(undefined);
      return;
    }

    try {
      const ctx = await buildAIAdvisorContext(bookings, restaurant);
      if (ctx) {
        setAIContext(ctx);
        setContextStatus("ready");
      } else {
        setContextStatus("unavailable");
      }
    } catch (err) {
      console.error("[AIAdvisor] context build error:", err);
      setContextStatus("unavailable");
      setAIContext(undefined);
    }
  };

  /* ---------- Initial effects ---------- */
  useEffect(() => {
    fetchModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Reload restaurant when auth user changes – also clear conversation */
  useEffect(() => {
    setMessages([]);
    setInput("");
    setPreviewOpen(false);
    setIsGenerating(false);
    abortRef.current?.abort(); // cancel any in‑flight generation
    fetchRestaurant();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /* Re‑run health check whenever selected model changes */
  useEffect(() => {
    if (selectedModel !== undefined) {
      localStorage.setItem(LOCAL_STORAGE_KEY, selectedModel);
      runConnectionCheck(selectedModel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModel]);

  /* Build AI context whenever its dependencies change */
  useEffect(() => {
    buildContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant, bookings, bookingsLoading]);

  /* ---------- Quick‑prompt helpers ---------- */
  const quickPrompts = [
    "Analyse today's bookings",
    "How can I reduce no-shows?",
    "Summarise current booking activity",
  ] as const;

  const applyPrompt = (prompt: typeof quickPrompts[number]) => {
    setInput(prompt);
  };

  /* ---------- Conversation helpers ---------- */
  const clearConversation = () => {
    setMessages([]);
    setInput("");
    setChatError(false);
    setLastUserMessage(null);
  };

  const stopGeneration = () => {
    abortRef.current?.abort();
    // Append a generation‑stopped note to the current assistant placeholder
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === "assistant") {
        const updated = {
          ...last,
          content: `${last.content}\n\n[Generation stopped]`,
        };
        return [...prev.slice(0, -1), updated];
      }
      return prev;
    });
    setIsGenerating(false);
    setChatError(false); // user‑initiated stop is not a retryable error
  };

  /* ---------- Retry handling ---------- */
  const retryLast = async () => {
    if (!lastUserMessage || !aiContext || !selectedModel) return;

    // Remove the failing assistant placeholder (last message)
    setMessages((prev) => prev.slice(0, -1));
    setChatError(false);
    setIsGenerating(true);
    abortRef.current = new AbortController();

    // Re‑use the same system prompt with grounding guardrails
    const systemPrompt = `You are TableFlow AI Advisor, a restaurant operations assistant. Follow these grounding rules strictly:

- Use ONLY the supplied restaurant context as the source of any restaurant‑specific facts.
- Never invent or approximate numbers such as revenue, prices, costs, booking durations, end times, staffing levels, or any quantitative data that is not present in the context.
- Never claim knowledge of data that is absent from the context.
- If a requested fact is not available, respond with exactly: "This information is not available in the current restaurant context."
- You may provide general advice or recommendations, but those must be prefixed with "General recommendation:" and must not be presented as facts about this specific restaurant.

Context:
${formatAIAdvisorContext(aiContext)}`;

    // Build the message list: system + ALL USER messages (including the last one)
    const ollamaMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages
        .filter((m) => m.role !== "assistant")
        .map((m) => ({ role: m.role as const, content: m.content })),
    ];

    try {
      let receivedChunk = false;

      await streamChat(
        ollamaMessages,
        selectedModel,
        (chunk) => {
          receivedChunk = true;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === "assistant") {
              const updated = { ...last, content: last.content + chunk };
              return [...prev.slice(0, -1), updated];
            }
            return prev;
          });
        },
        abortRef.current,
      );

      if (!receivedChunk) {
        // Stream ended without data → treat as interruption
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === "assistant") {
            const updated = {
              ...last,
              content: `${last.content}\n\n[Response interrupted]`,
            };
            return [...prev.slice(0, -1), updated];
          }
          return prev;
        });
        setChatError(true);
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        // should not happen here (user‑initiated stop), but handle gracefully
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === "assistant") {
            const updated = {
              ...last,
              content: `${last.content}\n\n[Generation stopped]`,
            };
            return [...prev.slice(0, -1), updated];
          }
          return prev;
        });
      } else {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          const errorMsg =
            "⚠️ An error occurred while generating the response. Please check the Ollama connection and try again.";
          if (last && last.role === "assistant") {
            const updated = { ...last, content: errorMsg };
            return [...prev.slice(0, -1), updated];
          }
          return [...prev, { role: "assistant", content: errorMsg }];
        });
        console.error("[AIAdvisor] chat generation error (retry):", err);
        setChatError(true);
      }
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  };

  /* ---------- Send handling ---------- */
  const canSend =
    connectionStatus === "connected" &&
    !!selectedModel &&
    contextStatus === "ready" &&
    input.trim().length > 0 &&
    !isGenerating;

  const handleSend = async () => {
    if (!canSend || !aiContext || !selectedModel) return;

    // Record the user message
    const userMsg: AdvisorMessage = {
      role: "user",
      content: input.trim(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLastUserMessage(userMsg);
        setInput("");

        // Placeholder assistant message
        const assistantPlaceholder: AdvisorMessage = {
          role: "assistant",
          content: "",
        };
        setMessages((prev) => [...prev, assistantPlaceholder]);

        setIsGenerating(true);
        abortRef.current = new AbortController();

        // ------------------------------------------------------------------
        // System prompt with strict grounding (same as in B4.4.1)
        // ------------------------------------------------------------------
        const systemPrompt = `You are TableFlow AI Advisor, a restaurant operations assistant. Follow these grounding rules strictly:

- Use ONLY the supplied restaurant context as the source of any restaurant‑specific facts.
- Never invent or approximate numbers such as revenue, prices, costs, booking durations, end times, staffing levels, or any quantitative data that is not present in the context.
- Never claim knowledge of data that is absent from the context.
- If a requested fact is not available, respond with exactly: "This information is not available in the current restaurant context."
- You may provide general advice or recommendations, but those must be prefixed with "General recommendation:" and must not be presented as facts about this specific restaurant.

Context:
${formatAIAdvisorContext(aiContext)}`;

        // Build the message list for Ollama (system + all user messages so far)
        const ollamaMessages = [
          { role: "system" as const, content: systemPrompt },
          ...messages
            .filter((m) => m.role !== "assistant") // exclude the placeholder we just added
            .map((m) => ({ role: m.role as const, content: m.content })),
        ];

        let receivedChunk = false;

        try {
          await streamChat(
            ollamaMessages,
            selectedModel,
            (chunk) => {
              receivedChunk = true;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.role === "assistant") {
                  const updated = { ...last, content: last.content + chunk };
                  return [...prev.slice(0, -1), updated];
                }
                return prev;
              });
            },
            abortRef.current,
          );

          // If the stream finished without delivering any chunk, treat it as interruption
          if (!receivedChunk) {
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.role === "assistant") {
                const updated = {
                  ...last,
                  content: `${last.content}\n\n[Response interrupted]`,
                };
                return [...prev.slice(0, -1), updated];
              }
              return prev;
            });
            setChatError(true);
          }
        } catch (err: any) {
          if (err.name === "AbortError") {
            // User‑initiated abort – already handled in stopGeneration, but keep a fallback
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.role === "assistant") {
                const updated = {
                  ...last,
                  content: `${last.content}\n\n[Generation stopped]`,
                };
                return [...prev.slice(0, -1), updated];
              }
              return prev;
            });
          } else {
            // Any other error → friendly UI message & mark for retry
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              const errorMsg =
                "⚠️ Unable to generate an AI response. Please check the Ollama connection and try again.";
              if (last && last.role === "assistant") {
                const updated = { ...last, content: errorMsg };
                return [...prev.slice(0, -1), updated];
              }
              return [...prev, { role: "assistant", content: errorMsg }];
            });
            console.error("[AIAdvisor] chat generation error:", err);
            setChatError(true);
          }
        } finally {
          setIsGenerating(false);
          abortRef.current = null;
        }
      };

  /* ---------- Model selector UI ---------- */
  const handleModelSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === "__none__") {
      setSelectedModel(undefined);
    } else {
      setSelectedModel(value);
    }
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

      {/* ----- Ollama connection panel ----- */}
      <div className="mb-6 p-4 border rounded-md bg-background">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium text-foreground">Ollama Service:</span>
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

        <div className="flex items-center justify-between">
          <label className="font-medium text-foreground">Model:</label>

          {modelsLoading ? (
            <span className="text-sm text-muted-foreground">
              Loading models…
            </span>
          ) : availableModels.length === 0 ? (
            <span className="text-sm text-destructive">
              No Ollama models installed
            </span>
          ) : (
            <select
              value={selectedModel ?? "__none__"}
              onChange={handleModelSelect}
              className="rounded border border-input bg-background px-2 py-1 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="__none__" disabled>
                -- select a model --
              </option>
              {availableModels.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Connection‑specific explanatory messages */}
        {connectionStatus === "offline" && (
          <p className="mt-2 text-sm text-destructive">
            Unable to connect to the Ollama service. Make sure Ollama is running
            and try again.
          </p>
        )}
        {connectionStatus === "timeout" && (
          <p className="mt-2 text-sm text-destructive">
            Connection to Ollama timed out. Please try again later.
          </p>
        )}
        {connectionStatus === "model_not_found" && (
          <p className="mt-2 text-sm text-destructive">
            The selected model is not available on this Ollama instance. Choose
            another model.
          </p>
        )}
        {connectionDetails && connectionStatus !== "offline" && (
          <p className="mt-2 text-xs text-muted-foreground">{connectionDetails}</p>
        )}

        <Button
          onClick={() => runConnectionCheck(selectedModel)}
          className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={connectionStatus === "checking"}
        >
          Check Connection
        </Button>
      </div>

      {/* ----- AI Context panel ----- */}
      <div className="mb-6 p-4 border rounded-md bg-background">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium text-foreground">AI Context:</span>
          <span
            className={`font-medium ${
              contextStatus === "ready"
                ? "text-primary"
                : contextStatus === "loading"
                ? "text-muted-foreground"
                : "text-destructive"
            }`}
          >
            {contextStatus === "ready"
              ? "Ready"
              : contextStatus === "loading"
              ? "Loading..."
              : "Unavailable"}
          </span>
        </div>

        <Button
          onClick={() => setPreviewOpen(!previewOpen)}
          className="mt-2 bg-muted text-muted-foreground hover:bg-muted/80"
        >
          {previewOpen ? "Hide Context Preview" : "Show Context Preview"}
        </Button>

        {previewOpen && (
          <div className="mt-4 max-h-64 overflow-y-auto bg-card rounded p-3 border border-border">
            {aiContext ? (
              <pre className="text-xs text-foreground whitespace-pre-wrap">
                {formatAIAdvisorContext(aiContext)}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground">
                No context available.
              </p>
            )}
          </div>
        )}

        <p className="mt-2 text-xs text-muted-foreground">
          Only the information shown here will be shared with the selected local
          AI model.
        </p>
      </div>

      {/* ----- Conversation area ----- */}
      <div className="flex flex-col gap-4">
        {/* Message list */}
        <div className="flex-1 min-h-[200px] p-4 border rounded bg-background overflow-y-auto">
          {messages.length === 0 ? (
            <p className="text-muted-foreground">
              Ask TableFlow AI Advisor about your restaurant operations,
              bookings, no‑shows, or customer enquiries.
            </p>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className="mb-2">
                {msg.role === "user" && (
                  <p className="text-foreground font-medium">
                    You: {msg.content}
                  </p>
                )}
                {msg.role === "assistant" && (
                  <p className="text-foreground">{msg.content}</p>
                )}
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

        {/* Input field */}
        <textarea
          rows={3}
          placeholder="Enter your question here…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full rounded-md border border-input bg-background p-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          disabled={isGenerating}
        />

        {/* Action buttons */}
        <div className="flex items-center gap-4">
          <Button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className={`bg-primary text-primary-foreground ${
              !canSend ? "opacity-50 cursor-not-allowed" : "hover:bg-primary/90"
            }`}
          >
            Send
          </Button>

          {isGenerating && (
            <Button
              type="button"
              onClick={stopGeneration}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Stop
            </Button>
          )}

          {chatError && (
            <Button
              type="button"
              onClick={retryLast}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Retry
            </Button>
          )}

          <Button
            type="button"
            onClick={clearConversation}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Clear Conversation
          </Button>

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