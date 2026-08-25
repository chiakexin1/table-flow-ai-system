"use client";

import React, { useEffect, useState } from "react";
import Button from "@/components/common/Button";
import {
  checkOllamaConnection,
  listOllamaModels,
  ollamaConfig,
  type OllamaConnectionStatus,
  type OllamaConnectionResult,
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
   UI helper – map internal status to a human-readable label.
   ------------------------------------------------------------------ */
function statusLabel(
  status: OllamaConnectionStatus | "checking",
): string {
  switch (status) {
    case "checking":
      return "Checking...";
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

  const [connectionDetails, setConnectionDetails] = useState<
    string | undefined
  >();

  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState<boolean>(true);
  const [selectedModel, setSelectedModel] = useState<
    string | undefined
  >();

  const LOCAL_STORAGE_KEY = "selectedOllamaModel";

  /* ---------- Restaurant state ---------- */
  const [restaurant, setRestaurant] = useState<any>(null);
  const [restaurantLoading, setRestaurantLoading] =
    useState<boolean>(true);

  /* ---------- AI Context state ---------- */
  const [aiContext, setAIContext] = useState<
    AIAdvisorContext | undefined
  >();

  const [contextStatus, setContextStatus] = useState<
    "loading" | "ready" | "unavailable"
  >("loading");

  const [previewOpen, setPreviewOpen] = useState<boolean>(false);

  /* ---------- Conversation UI state ---------- */
  const [messages, setMessages] = useState<string[]>([]);
  const [input, setInput] = useState("");

  /* ------------------------------------------------------------------
     Load installed Ollama models.
     ------------------------------------------------------------------ */
  const fetchModels = async () => {
    setModelsLoading(true);

    try {
      const models = await listOllamaModels();

      setAvailableModels(models);

      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);

      if (stored && models.includes(stored)) {
        setSelectedModel(stored);
      } else if (
        ollamaConfig.model &&
        models.includes(ollamaConfig.model)
      ) {
        setSelectedModel(ollamaConfig.model);
      } else if (models.length > 0) {
        setSelectedModel(models[0]);
      } else {
        setSelectedModel(undefined);
      }
    } catch (error) {
      setAvailableModels([]);
      setSelectedModel(undefined);
      setConnectionStatus("offline");
      setConnectionDetails(
        error instanceof Error
          ? error.message
          : "Unable to load Ollama models",
      );
    } finally {
      setModelsLoading(false);
    }
  };

  /* ------------------------------------------------------------------
     Run Ollama connectivity check.
     ------------------------------------------------------------------ */
  const runConnectionCheck = async (modelToCheck?: string) => {
    setConnectionStatus("checking");
    setConnectionDetails(undefined);

    try {
      const result: OllamaConnectionResult =
        await checkOllamaConnection(modelToCheck);

      setConnectionStatus(result.status);
      setConnectionDetails(result.details);
    } catch (error) {
      setConnectionStatus("offline");

      setConnectionDetails(
        error instanceof Error
          ? error.message
          : "Unable to connect to Ollama",
      );
    }
  };

  /* ------------------------------------------------------------------
     Load restaurant for current authenticated user.
     ------------------------------------------------------------------ */
  const fetchRestaurant = async () => {
    if (!user) {
      setRestaurant(null);
      setRestaurantLoading(false);
      setAIContext(undefined);
      setContextStatus("unavailable");
      return;
    }

    /*
      Clear previous user's restaurant/context immediately so stale data
      cannot remain visible during an account switch.
    */
    setRestaurant(null);
    setAIContext(undefined);
    setContextStatus("loading");
    setRestaurantLoading(true);

    try {
      const currentRestaurant =
        await getOrCreateRestaurantForCurrentUser();

      setRestaurant(currentRestaurant);
    } catch (error) {
      console.error(
        "[AIAdvisor] restaurant fetch error:",
        error,
      );

      setRestaurant(null);
      setAIContext(undefined);
      setContextStatus("unavailable");
    } finally {
      setRestaurantLoading(false);
    }
  };

  /* ------------------------------------------------------------------
     Build minimised AI context.
     ------------------------------------------------------------------ */
  const buildContext = async () => {
    if (
      authLoading ||
      restaurantLoading ||
      bookingsLoading
    ) {
      setContextStatus("loading");
      setAIContext(undefined);
      return;
    }

    if (
      !user ||
      !restaurant ||
      bookingsError ||
      !bookings
    ) {
      setContextStatus("unavailable");
      setAIContext(undefined);
      return;
    }

    try {
      const context = await buildAIAdvisorContext(
        bookings,
        restaurant,
      );

      if (context) {
        setAIContext(context);
        setContextStatus("ready");
      } else {
        setAIContext(undefined);
        setContextStatus("unavailable");
      }
    } catch (error) {
      console.error(
        "[AIAdvisor] context build error:",
        error,
      );

      setAIContext(undefined);
      setContextStatus("unavailable");
    }
  };

  /* ------------------------------------------------------------------
     Initial Ollama model discovery.
     ------------------------------------------------------------------ */
  useEffect(() => {
    fetchModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------------------------------------------
     Reload restaurant whenever authenticated user changes.
     ------------------------------------------------------------------ */
  useEffect(() => {
    fetchRestaurant();

    /*
      Clear conversation as an extra privacy safeguard when users switch.
    */
    setMessages([]);
    setInput("");
    setPreviewOpen(false);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /* ------------------------------------------------------------------
     Re-run health check whenever selected model changes.
     ------------------------------------------------------------------ */
  useEffect(() => {
    if (selectedModel !== undefined) {
      localStorage.setItem(
        LOCAL_STORAGE_KEY,
        selectedModel,
      );

      runConnectionCheck(selectedModel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModel]);

  /* ------------------------------------------------------------------
     Rebuild context whenever relevant authorised data changes.
     ------------------------------------------------------------------ */
  useEffect(() => {
    buildContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user,
    authLoading,
    restaurant,
    restaurantLoading,
    bookings,
    bookingsLoading,
    bookingsError,
  ]);

  /* ------------------------------------------------------------------
     Conversation helpers.
     ------------------------------------------------------------------ */
  const clearConversation = () => {
    setMessages([]);
    setInput("");
  };

  const quickPrompts = [
    "Analyse today's bookings",
    "How can I reduce no-shows?",
    "Summarise current booking activity",
  ] as const;

  const applyPrompt = (
    prompt: (typeof quickPrompts)[number],
  ) => {
    setInput(prompt);
  };

  /* ------------------------------------------------------------------
     Runtime model selector.
     ------------------------------------------------------------------ */
  const handleModelSelect = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const value = event.target.value;

    if (value === "__none__") {
      setSelectedModel(undefined);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      return;
    }

    setSelectedModel(value);
  };

  return (
    <section className="max-w-4xl mx-auto p-6 bg-card rounded-lg shadow">
      {/* ============================================================
          Header
          ============================================================ */}
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">
          AI Advisor
        </h1>

        <p className="text-muted-foreground">
          Get AI-powered operational insights for your
          restaurant.
        </p>
      </header>

      {/* ============================================================
          Ollama connection panel
          ============================================================ */}
      <div className="mb-6 p-4 border rounded-md bg-background">
        <div className="flex items-center justify-between mb-3">
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

        {/* Model selector */}
        <div className="flex items-center justify-between gap-4">
          <label
            htmlFor="ollama-model"
            className="font-medium text-foreground"
          >
            Model:
          </label>

          {modelsLoading ? (
            <span className="text-sm text-muted-foreground">
              Loading models...
            </span>
          ) : availableModels.length === 0 ? (
            <span className="text-sm text-destructive">
              No Ollama models installed
            </span>
          ) : (
            <select
              id="ollama-model"
              value={selectedModel ?? "__none__"}
              onChange={handleModelSelect}
              className="min-w-[260px] rounded border border-input bg-background px-3 py-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="__none__">
                -- select a model --
              </option>

              {availableModels.map((model) => (
                <option
                  key={model}
                  value={model}
                >
                  {model}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Selected model */}
        {selectedModel && (
          <p className="mt-3 text-sm text-foreground">
            Selected model:{" "}
            <span className="font-medium">
              {selectedModel}
            </span>
          </p>
        )}

        {/* Technical details */}
        {connectionDetails && (
          <p className="mt-2 text-xs text-muted-foreground">
            {connectionDetails}
          </p>
        )}

        <Button
          type="button"
          onClick={() =>
            runConnectionCheck(selectedModel)
          }
          disabled={connectionStatus === "checking"}
          className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {connectionStatus === "checking"
            ? "Checking..."
            : "Check Connection"}
        </Button>
      </div>

      {/* ============================================================
          AI Context status + preview
          ============================================================ */}
      <div className="mb-6 p-4 border rounded-md bg-background">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium text-foreground">
            AI Context:
          </span>

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

        {bookingsError && (
          <p className="mt-2 text-sm text-destructive">
            Unable to prepare booking context.
          </p>
        )}

        <Button
          type="button"
          onClick={() =>
            setPreviewOpen((current) => !current)
          }
          disabled={contextStatus !== "ready"}
          className="mt-2 bg-muted text-muted-foreground hover:bg-muted/80"
        >
          {previewOpen
            ? "Hide Context Preview"
            : "Show Context Preview"}
        </Button>

        {previewOpen && (
          <div className="mt-4 max-h-64 overflow-y-auto bg-card rounded p-3 border border-border">
            {aiContext ? (
              <pre className="text-xs text-foreground whitespace-pre-wrap break-words">
                {formatAIAdvisorContext(aiContext)}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground">
                No context available.
              </p>
            )}
          </div>
        )}

        <p className="mt-3 text-xs text-muted-foreground">
          Only the information shown here will be shared
          with the selected local AI model.
        </p>
      </div>

      {/* ============================================================
          Conversation area
          ============================================================ */}
      <div className="flex flex-col gap-4">
        {/* Message area */}
        <div className="flex-1 min-h-[200px] p-4 border rounded bg-background overflow-y-auto">
          {messages.length === 0 ? (
            <p className="text-muted-foreground">
              Ask TableFlow AI Advisor about your
              restaurant operations, bookings, no-shows,
              or customer enquiries.
            </p>
          ) : (
            messages.map((message, index) => (
              <div
                key={`${index}-${message}`}
                className="mb-2"
              >
                <p className="text-foreground">
                  {message}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Quick prompts */}
        <div className="flex flex-wrap gap-2">
          {quickPrompts.map((prompt) => (
            <Button
              type="button"
              key={prompt}
              onClick={() => applyPrompt(prompt)}
              className="bg-muted text-muted-foreground hover:bg-muted/80"
            >
              {prompt}
            </Button>
          ))}
        </div>

        {/* Question input */}
        <textarea
          rows={3}
          placeholder="Enter your question here..."
          value={input}
          onChange={(event) =>
            setInput(event.target.value)
          }
          className="w-full rounded-md border border-input bg-background p-3 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Intentionally disabled until B4.4 */}
          <Button
            type="button"
            disabled
            className="bg-primary text-primary-foreground opacity-50 cursor-not-allowed"
          >
            Send
          </Button>

          <Button
            type="button"
            onClick={clearConversation}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Clear Conversation
          </Button>

          <span className="text-sm text-muted-foreground">
            AI responses will be enabled in the next
            implementation stage.
          </span>
        </div>

        {/* Privacy notice */}
        <p className="mt-2 text-xs text-muted-foreground">
          Only relevant restaurant context will be shared
          with the local AI model when you submit a
          request.
        </p>
      </div>
    </section>
  );
}