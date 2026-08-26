"use client";

import React, { useEffect, useRef, useState } from "react";
import Button from "@/components/common/Button";
import {
  checkOllamaConnection,
  listOllamaModels,
  ollamaConfig,
  streamChat,
  type OllamaConnectionResult,
  type OllamaConnectionStatus,
} from "@/services/ollama";
import {
  buildAIAdvisorContext,
  formatAIAdvisorContext,
  type AIAdvisorContext,
} from "@/services/aiContext";
import { useBooking } from "@/context/BookingContext";
import { useAuth } from "@/context/AuthContext";
import { getOrCreateRestaurantForCurrentUser } from "@/services/restaurantService";

type AdvisorMessage = {
  role: "user" | "assistant";
  content: string;
};

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

export default function AIAdvisor() {
  const { user, loading: authLoading } = useAuth();

  const {
    bookings,
    loading: bookingsLoading,
    error: bookingsError,
  } = useBooking();

  const [connectionStatus, setConnectionStatus] = useState<
    OllamaConnectionStatus | "checking"
  >("checking");

  const [connectionDetails, setConnectionDetails] = useState<
    string | undefined
  >();

  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState<
    string | undefined
  >();

  const [restaurant, setRestaurant] = useState<any>(null);
  const [restaurantLoading, setRestaurantLoading] = useState(true);

  const [aiContext, setAIContext] = useState<
    AIAdvisorContext | undefined
  >();

  const [contextStatus, setContextStatus] = useState<
    "loading" | "ready" | "unavailable"
  >("loading");

  const [previewOpen, setPreviewOpen] = useState(false);

  const [messages, setMessages] = useState<AdvisorMessage[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const LOCAL_STORAGE_KEY = "selectedOllamaModel";

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

  const fetchRestaurant = async () => {
    if (!user) {
      setRestaurant(null);
      setRestaurantLoading(false);
      setAIContext(undefined);
      setContextStatus("unavailable");
      return;
    }

    setRestaurant(null);
    setAIContext(undefined);
    setContextStatus("loading");
    setRestaurantLoading(true);

    try {
      const currentRestaurant =
        await getOrCreateRestaurantForCurrentUser();

      setRestaurant(currentRestaurant);
    } catch (error) {
      console.error("[AIAdvisor] restaurant fetch error:", error);

      setRestaurant(null);
      setAIContext(undefined);
      setContextStatus("unavailable");
    } finally {
      setRestaurantLoading(false);
    }
  };

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
      console.error("[AIAdvisor] context build error:", error);

      setAIContext(undefined);
      setContextStatus("unavailable");
    }
  };

  useEffect(() => {
    fetchModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;

    setMessages([]);
    setInput("");
    setPreviewOpen(false);
    setIsGenerating(false);

    fetchRestaurant();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (selectedModel) {
      localStorage.setItem(
        LOCAL_STORAGE_KEY,
        selectedModel,
      );

      runConnectionCheck(selectedModel);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModel]);

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

  const clearConversation = () => {
    if (isGenerating) {
      abortRef.current?.abort();
    }

    abortRef.current = null;
    setIsGenerating(false);
    setMessages([]);
    setInput("");
  };

  const stopGeneration = () => {
    abortRef.current?.abort();
  };

  const canSend =
    connectionStatus === "connected" &&
    Boolean(selectedModel) &&
    contextStatus === "ready" &&
    input.trim().length > 0 &&
    !isGenerating;

  const handleSend = async () => {
    if (!canSend || !aiContext || !selectedModel) {
      return;
    }

    const question = input.trim();

    const userMessage: AdvisorMessage = {
      role: "user",
      content: question,
    };

    const assistantPlaceholder: AdvisorMessage = {
      role: "assistant",
      content: "",
    };

    const priorMessages = messages;

    setMessages([
      ...priorMessages,
      userMessage,
      assistantPlaceholder,
    ]);

    setInput("");
    setIsGenerating(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const systemPrompt = [
      "You are TableFlow AI Advisor, a restaurant operations assistant.",
      "Use only the supplied restaurant context when making factual claims about this restaurant.",
      "Do not invent booking facts, customer information, counts, statuses, or operational details that are not present.",
      "If the provided context is insufficient, clearly say what information is unavailable.",
      "",
      "Restaurant context:",
      formatAIAdvisorContext(aiContext),
    ].join("\n");

    const ollamaMessages = [
      {
        role: "system" as const,
        content: systemPrompt,
      },
      ...priorMessages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      {
        role: "user" as const,
        content: question,
      },
    ];

    try {
      await streamChat(
        ollamaMessages,
        selectedModel,
        (chunk) => {
          setMessages((currentMessages) => {
            const lastMessage =
              currentMessages[currentMessages.length - 1];

            if (
              !lastMessage ||
              lastMessage.role !== "assistant"
            ) {
              return currentMessages;
            }

            const updatedAssistant: AdvisorMessage = {
              ...lastMessage,
              content: lastMessage.content + chunk,
            };

            return [
              ...currentMessages.slice(0, -1),
              updatedAssistant,
            ];
          });
        },
        controller,
      );
    } catch (error) {
      if (controller.signal.aborted) {
        setMessages((currentMessages) => {
          const lastMessage =
            currentMessages[currentMessages.length - 1];

          if (
            !lastMessage ||
            lastMessage.role !== "assistant"
          ) {
            return currentMessages;
          }

          if (lastMessage.content.trim().length > 0) {
            return currentMessages;
          }

          const stoppedMessage: AdvisorMessage = {
            role: "assistant",
            content: "Generation stopped.",
          };

          return [
            ...currentMessages.slice(0, -1),
            stoppedMessage,
          ];
        });

        return;
      }

      setMessages((currentMessages) => {
        const lastMessage =
          currentMessages[currentMessages.length - 1];

        const errorMessage =
          "AI Advisor could not generate a response. Please check the Ollama connection and try again.";

        if (
          lastMessage &&
          lastMessage.role === "assistant"
        ) {
          const updatedAssistant: AdvisorMessage = {
            ...lastMessage,
            content:
              lastMessage.content.trim().length > 0
                ? lastMessage.content
                : errorMessage,
          };

          return [
            ...currentMessages.slice(0, -1),
            updatedAssistant,
          ];
        }

        return [
          ...currentMessages,
          {
            role: "assistant",
            content: errorMessage,
          },
        ];
      });

      console.error(
        "[AIAdvisor] chat generation error:",
        error,
      );
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }

      setIsGenerating(false);
    }
  };

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
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">
          AI Advisor
        </h1>

        <p className="text-muted-foreground">
          Get AI-powered operational insights for your
          restaurant.
        </p>
      </header>

      {/* Ollama connection */}
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
              disabled={isGenerating}
              className="min-w-[260px] rounded border border-input bg-background px-3 py-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
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

        {selectedModel && (
          <p className="mt-3 text-sm text-foreground">
            Selected model:{" "}
            <span className="font-medium">
              {selectedModel}
            </span>
          </p>
        )}

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
          disabled={
            connectionStatus === "checking" ||
            isGenerating
          }
          className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {connectionStatus === "checking"
            ? "Checking..."
            : "Check Connection"}
        </Button>
      </div>

      {/* AI context */}
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
          <div className="mt-4 max-h-64 overflow-y-auto rounded border border-border bg-card p-3">
            {aiContext ? (
              <pre className="whitespace-pre-wrap break-words text-xs text-foreground">
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

      {/* Conversation */}
      <div className="flex flex-col gap-4">
        <div className="min-h-[220px] overflow-y-auto rounded border bg-background p-4">
          {messages.length === 0 ? (
            <p className="text-muted-foreground">
              Ask TableFlow AI Advisor about your
              restaurant operations, bookings, no-shows,
              or customer enquiries.
            </p>
          ) : (
            messages.map((message, index) => (
              <div
                key={`${index}-${message.role}`}
                className="mb-4"
              >
                {message.role === "user" ? (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      You
                    </p>
                    <p className="text-foreground">
                      {message.content}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      AI Advisor
                    </p>
                    <p className="whitespace-pre-wrap text-foreground">
                      {message.content ||
                        (isGenerating
                          ? "Generating response..."
                          : "")}
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {quickPrompts.map((prompt) => (
            <Button
              type="button"
              key={prompt}
              onClick={() => applyPrompt(prompt)}
              disabled={isGenerating}
              className="bg-muted text-muted-foreground hover:bg-muted/80"
            >
              {prompt}
            </Button>
          ))}
        </div>

        <textarea
          rows={3}
          placeholder="Enter your question here..."
          value={input}
          onChange={(event) =>
            setInput(event.target.value)
          }
          disabled={isGenerating}
          className="w-full rounded-md border border-input bg-background p-3 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className={`bg-primary text-primary-foreground ${
              !canSend
                ? "cursor-not-allowed opacity-50"
                : "hover:bg-primary/90"
            }`}
          >
            {isGenerating ? "Generating..." : "Send"}
          </Button>

          {isGenerating && (
            <Button
              type="button"
              onClick={stopGeneration}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Stop Generation
            </Button>
          )}

          <Button
            type="button"
            onClick={clearConversation}
            className="bg-muted text-muted-foreground hover:bg-muted/80"
          >
            Clear Conversation
          </Button>

          {isGenerating && (
            <span className="text-sm text-muted-foreground">
              AI Advisor is generating a response...
            </span>
          )}
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          Only relevant restaurant context will be shared
          with the selected local AI model when you submit
          a request.
        </p>
      </div>
    </section>
  );
}