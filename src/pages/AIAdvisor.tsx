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
  const { bookings, loading: bookingsLoading, error: bookingsError } =
    useBooking();

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
  const [contextStatus, setContextStatus] = useState<
    "loading" | "ready" | "unavailable"
  >("loading");
  const [previewOpen, setPreviewOpen] = useState<boolean>(false);

  /* ---------- Conversation state ---------- */
  const [messages, setMessages] = useState<AdvisorMessage[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const abortRef = useRef<AbortController | null>(null);

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
    //<dyad-write path="src/pages/AIAdvisor.tsx" description="Continuation of AIAdvisor component – added effects, send/stop logic, quick prompts, UI rendering with streaming chat">
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
  const { bookings, loading: bookingsLoading, error: bookingsError } =
    useBooking();

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
  const [contextStatus, setContextStatus] = useState<
    "loading" | "ready" | "unavailable"
  >("loading");
  const [previewOpen, setPreviewOpen] = useState<boolean>(false);

  /* ---------- Conversation state ---------- */
  const [messages, setMessages] = useState<AdvisorMessage[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const abortRef = useRef<AbortController | null>(null);

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

  /* ---------- Initial mounts ---------- */
  useEffect(() => {
    fetchModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Reload restaurant (and clear chat) whenever auth user changes */
  useEffect(() => {
    setMessages([]);
    setInput("");
    setPreviewOpen(false);
    setIsGenerating(false);
    abortRef.current?.abort();
    fetchRestaurant();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /* Re‑run health check when selected model changes */
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
  };

  const stopGeneration = () => {
    abortRef.current?.abort();
    setIsGenerating(false);
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

    // Add the user's message to the UI
    const userMsg: AdvisorMessage = {
      role: "user",
      content: input.trim(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    // Prepare assistant placeholder
    const assistantPlaceholder: AdvisorMessage = {
      role: "assistant",
      content: "",
    };
    setMessages((prev) => [...prev, assistantPlaceholder]);

    setIsGenerating(true);
    abortRef.current = new AbortController();

    // Build system prompt with minimised context
    const systemPrompt = `You are TableFlow AI Advisor, a restaurant operations assistant. Use only the supplied context to answer. Do not fabricate information that is not present in the context.\n\nContext:\n${formatAIAdvisorContext(
      aiContext,
    )}`;

    // Build Ollama message list (system + all user messages so far)
    const ollamaMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages
        .filter((m) => m.role !== "assistant") // exclude the placeholder we just added
        .map((m) => ({ role: m.role as const, content: m.content })),
    ];

    try {
      await streamChat(
        ollamaMessages,
        selectedModel,
        (chunk) => {
          // Append chunk to the latest assistant message
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
    } catch (err: any) {
      // Show a friendly error assistant message
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === "assistant") {
          const errorMsg = {
            ...last,
            content:
              "⚠️ An error occurred while generating the response. Please try again later.",
          };
          return [...prev.slice(0, -1), errorMsg];
        }
        // If for some reason we don't have a placeholder, just push an error message
        return [
          ...prev,
          {
            role: "assistant",
            content:
              "⚠️ An error occurred while generating the response. Please try again later.",
          },
        ];
      });
      console.error("[AIAdvisor] chat generation error:", err);
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
          <span className="font-medium text-foreground">
            Ollama Service:
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

        {connectionStatus === "connected" && selectedModel && (
          <p className="mt-2 text-sm text-foreground">
            Selected model: <span className="font-medium">{selectedModel}</span>
          </p>
        )}

        {connectionDetails && (
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

        {/* Input area */}
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
              !canSend ? "opacity<dyad-write path="src/pages/AIAdvisor.tsx" description="Finished UI rendering, added Send/Stop logic, completed JSX">
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
  const { bookings, loading: bookingsLoading, error: bookingsError } =
    useBooking();

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

  /* ---------- Initial mounting ---------- */
  useEffect(() => {
    fetchModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Reload restaurant (and clear chat) whenever auth user changes */
  useEffect(() => {
    setMessages([]);
    setInput("");
    setPreviewOpen(false);
    setIsGenerating(false);
    abortRef.current?.abort();
    fetchRestaurant();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /* Re‑run health check when selected model changes */
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
  };

  const stopGeneration = () => {
    abortRef.current?.abort();
    setIsGenerating(false);
  };

  /* ---------- Send button enable logic ---------- */
  const canSend =
    connectionStatus === "connected" &&
    !!selectedModel &&
    contextStatus === "ready" &&
    input.trim().length > 0 &&
    !isGenerating;

  /* ---------- Handle Send ---------- */
  const handleSend = async () => {
    if (!canSend || !aiContext || !selectedModel) return;

    const userMsg: AdvisorMessage = {
      role: "user",
      content: input.trim(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    // Add a placeholder assistant message
    const assistantPlaceholder: AdvisorMessage = {
      role: "assistant",
      content: "",
    };
    setMessages((prev) => [...prev, assistantPlaceholder]);

    setIsGenerating(true);
    abortRef.current = new AbortController();

    const systemPrompt = `You are TableFlow AI Advisor, a restaurant operations assistant. Use only the supplied context to answer. Do not fabricate information that is not present in the context.\n\nContext:\n${formatAIAdvisorContext(
      aiContext,
    )}`;

    // Build messages for Ollama (system + all user messages so far)
    const ollamaMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages
        .filter((m) => m.role !== "assistant") // exclude the placeholder we just added
        .map((m) => ({ role: m.role as const, content: m.content })),
    ];

    try {
      await streamChat(
        ollamaMessages,
        selectedModel,
        (chunk) => {
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
    } catch (err: any) {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        const errorMsg =
          "⚠️ An error occurred while generating the response. Please try again later.";
        if (last && last.role === "assistant") {
          const updated = { ...last, content: errorMsg };
          return [...prev.slice(0, -1), updated];
        }
        return [...prev, { role: "assistant", content: errorMsg }];
      });
      console.error("[AIAdvisor] chat generation error:", err);
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
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">AI Advisor</h1>
        <p className="text-muted-foreground">
          Get AI‑powered operational insights for your restaurant.
        </p>
      </header>

      {/* Ollama connection panel */}
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

        {connectionStatus === "connected" && selectedModel && (
          <p className="mt-2 text-sm text-foreground">
            Selected model: <span className="font-medium">{selectedModel}</span>
          </p>
        )}

        {connectionDetails && (
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

      {/* AI Context panel */}
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

      {/* Conversation area */}
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

        {/* Privacy notice */}
        <p className="mt-2 text-xs text-muted-foreground">
          Only relevant restaurant context will be shared with the local AI
          model when you submit a request.
        </p>
      </div>
    </section>
  );
}