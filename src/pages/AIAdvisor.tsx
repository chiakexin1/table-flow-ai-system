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

/* ------------------------------------------------------------------
   Types
   ------------------------------------------------------------------ */

type AdvisorMessage = {
  role: "user" | "assistant";
  content: string;
};

/* ------------------------------------------------------------------
   Ollama status label
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
   Main page
   ------------------------------------------------------------------ */

export default function AIAdvisor() {
  /* ----------------------------------------------------------------
     Auth / booking data
     ---------------------------------------------------------------- */

  const { user } = useAuth();

  const {
    bookings,
    loading: bookingsLoading,
  } = useBooking();

  /* ----------------------------------------------------------------
     Ollama state
     ---------------------------------------------------------------- */

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

  const LOCAL_STORAGE_KEY = "selectedOllamaModel";

  /* ----------------------------------------------------------------
     Restaurant state
     ---------------------------------------------------------------- */

  const [restaurant, setRestaurant] = useState<any>(null);

  /* ----------------------------------------------------------------
     AI context state
     ---------------------------------------------------------------- */

  const [aiContext, setAIContext] = useState<
    AIAdvisorContext | undefined
  >();

  const [contextStatus, setContextStatus] = useState<
    "loading" | "ready" | "unavailable"
  >("loading");

  const [previewOpen, setPreviewOpen] = useState(false);

  /* ----------------------------------------------------------------
     Chat state
     ---------------------------------------------------------------- */

  const [messages, setMessages] = useState<AdvisorMessage[]>([]);
  const [input, setInput] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  /* ----------------------------------------------------------------
     Load Ollama models
     ---------------------------------------------------------------- */

  const fetchModels = async () => {
    setModelsLoading(true);

    try {
      const models = await listOllamaModels();

      setAvailableModels(models);

      const storedModel =
        localStorage.getItem(LOCAL_STORAGE_KEY);

      if (
        storedModel &&
        models.includes(storedModel)
      ) {
        setSelectedModel(storedModel);
        return;
      }

      if (
        ollamaConfig.model &&
        models.includes(ollamaConfig.model)
      ) {
        setSelectedModel(ollamaConfig.model);
        return;
      }

      if (models.length > 0) {
        setSelectedModel(models[0]);
        return;
      }

      setSelectedModel(undefined);
    } catch (error) {
      console.error(
        "[AIAdvisor] model loading error:",
        error,
      );

      setAvailableModels([]);
      setSelectedModel(undefined);
    } finally {
      setModelsLoading(false);
    }
  };

  /* ----------------------------------------------------------------
     Ollama health check
     ---------------------------------------------------------------- */

  const runConnectionCheck = async (
    modelToCheck?: string,
  ) => {
    setConnectionStatus("checking");
    setConnectionDetails(undefined);

    try {
      const result: OllamaConnectionResult =
        await checkOllamaConnection(modelToCheck);

      setConnectionStatus(result.status);

      if (result.details) {
        setConnectionDetails(result.details);
      }
    } catch (error) {
      setConnectionStatus("offline");

      setConnectionDetails(
        error instanceof Error
          ? error.message
          : "Unknown Ollama connection error",
      );
    }
  };

  /* ----------------------------------------------------------------
     Restaurant bootstrap
     ---------------------------------------------------------------- */

  const fetchRestaurant = async () => {
    if (!user) {
      setRestaurant(null);
      return;
    }

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
    }
  };

  /* ----------------------------------------------------------------
     Build minimised AI context
     ---------------------------------------------------------------- */

  const buildContext = async () => {
    if (
      !restaurant ||
      bookingsLoading ||
      !bookings
    ) {
      setContextStatus("loading");
      setAIContext(undefined);
      return;
    }

    try {
      const context =
        await buildAIAdvisorContext(
          bookings,
          restaurant,
        );

      if (!context) {
        setContextStatus("unavailable");
        setAIContext(undefined);
        return;
      }

      setAIContext(context);
      setContextStatus("ready");
    } catch (error) {
      console.error(
        "[AIAdvisor] context build error:",
        error,
      );

      setAIContext(undefined);
      setContextStatus("unavailable");
    }
  };

  /* ----------------------------------------------------------------
     Effects
     ---------------------------------------------------------------- */

  useEffect(() => {
    fetchModels();
  }, []);

  useEffect(() => {
    /*
      Prevent conversation/state leakage when
      switching authenticated users.
    */
    abortRef.current?.abort();
    abortRef.current = null;

    setMessages([]);
    setInput("");
    setPreviewOpen(false);
    setIsGenerating(false);

    setRestaurant(null);
    setAIContext(undefined);
    setContextStatus("loading");

    fetchRestaurant();
  }, [user]);

  useEffect(() => {
    if (!selectedModel) {
      return;
    }

    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      selectedModel,
    );

    runConnectionCheck(selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    buildContext();
  }, [
    restaurant,
    bookings,
    bookingsLoading,
  ]);

  /* ----------------------------------------------------------------
     Quick prompts
     ---------------------------------------------------------------- */

  const quickPrompts = [
    "Analyse today's bookings",
    "How can I reduce no-shows?",
    "Summarise current booking activity",
  ] as const;

  const applyPrompt = (
    prompt: (typeof quickPrompts)[number],
  ) => {
    if (isGenerating) {
      return;
    }

    setInput(prompt);
  };

  /* ----------------------------------------------------------------
     Conversation controls
     ---------------------------------------------------------------- */

  const clearConversation = () => {
    if (isGenerating) {
      abortRef.current?.abort();
      abortRef.current = null;
      setIsGenerating(false);
    }

    setMessages([]);
    setInput("");
  };

  const stopGeneration = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsGenerating(false);
  };

  /* ----------------------------------------------------------------
     Send eligibility
     ---------------------------------------------------------------- */

  const canSend =
    connectionStatus === "connected" &&
    Boolean(selectedModel) &&
    contextStatus === "ready" &&
    input.trim().length > 0 &&
    !isGenerating;

  /* ----------------------------------------------------------------
     Send question to Ollama
     ---------------------------------------------------------------- */

  const handleSend = async () => {
    if (
      !canSend ||
      !aiContext ||
      !selectedModel
    ) {
      return;
    }

    const question = input.trim();

    if (!question) {
      return;
    }

    const userMessage: AdvisorMessage = {
      role: "user",
      content: question,
    };

    /*
      IMPORTANT:
      Capture the conversation BEFORE React state changes.

      This ensures the latest user question is actually
      included in the request sent to Ollama.
    */
    const conversationForRequest = [
      ...messages,
      userMessage,
    ];

    /*
      Display user message and empty assistant placeholder.
      Streaming chunks will be appended to this assistant entry.
    */
    setMessages([
      ...conversationForRequest,
      {
        role: "assistant",
        content: "",
      },
    ]);

    setInput("");
    setIsGenerating(true);

    const controller = new AbortController();
    abortRef.current = controller;

    /* --------------------------------------------------------------
       Grounded system prompt

       Restaurant-specific factual claims must come only from
       the minimised context generated by B4.3.
       -------------------------------------------------------------- */

    const systemPrompt = `
You are TableFlow AI Advisor, an operational assistant for a restaurant booking management application.

GROUNDING RULES

1. Use ONLY the supplied restaurant context below as the source of restaurant-specific facts.

2. Never invent, estimate, infer, or assume missing restaurant-specific information.

3. Never invent or approximate:
- revenue
- prices
- costs
- financial impact
- booking duration
- booking end time
- customer behaviour
- staffing levels
- employee numbers
- restaurant capacity
- sales
- menu information
- operating costs
- demand that is not shown in the context
- any other numeric value not explicitly available in the context

4. Do not convert missing data into zero.
For example, if revenue information is unavailable, do NOT say revenue is RM0 or $0.

5. If the user asks for factual information that is not available in the supplied context, say:
"This information is not available in the current restaurant context."

6. General operational advice is allowed.

7. Any advice that is not directly supported by the restaurant context must be clearly introduced with:
"General recommendation:"

8. Do not present a general recommendation as an observed fact about this restaurant.

9. Do not invent an end time for a booking when only the booking start time is supplied.

10. Do not state how many employees should be scheduled unless staffing information and required operational data are supplied.

11. When analysing bookings:
- distinguish known facts from recommendations
- use exact booking counts and statuses provided by the context
- do not create additional bookings, customers, statuses, times, dates, or metrics

12. Be concise, practical, and transparent about unavailable information.

CURRENT RESTAURANT CONTEXT

${formatAIAdvisorContext(aiContext)}
`.trim();

    const ollamaMessages = [
      {
        role: "system" as const,
        content: systemPrompt,
      },

      ...conversationForRequest.map(
        (message) => ({
          role: message.role,
          content: message.content,
        }),
      ),
    ];

    try {
      let receivedContent = false;

      await streamChat(
        ollamaMessages,
        selectedModel,

        (chunk: string) => {
          if (!chunk) {
            return;
          }

          receivedContent = true;

          setMessages((previousMessages) => {
            if (
              previousMessages.length === 0
            ) {
              return previousMessages;
            }

            const lastIndex =
              previousMessages.length - 1;

            const lastMessage =
              previousMessages[lastIndex];

            if (
              lastMessage.role !== "assistant"
            ) {
              return previousMessages;
            }

            const updatedAssistant: AdvisorMessage = {
              ...lastMessage,
              content:
                lastMessage.content + chunk,
            };

            return [
              ...previousMessages.slice(
                0,
                lastIndex,
              ),
              updatedAssistant,
            ];
          });
        },

        controller,
      );

      /*
        A successful HTTP response with no assistant
        content should not leave an invisible blank entry.
      */
      if (!receivedContent) {
        setMessages((previousMessages) => {
          if (
            previousMessages.length === 0
          ) {
            return previousMessages;
          }

          const lastIndex =
            previousMessages.length - 1;

          const lastMessage =
            previousMessages[lastIndex];

          if (
            lastMessage.role !== "assistant" ||
            lastMessage.content.trim().length > 0
          ) {
            return previousMessages;
          }

          return [
            ...previousMessages.slice(
              0,
              lastIndex,
            ),
            {
              role: "assistant",
              content:
                "No response content was returned by the selected AI model. Please try again.",
            },
          ];
        });
      }
    } catch (error: unknown) {
      /*
        User intentionally pressed Stop Generation.
        Preserve any partial response already streamed.
      */
      const aborted =
        error instanceof DOMException &&
        error.name === "AbortError";

      if (aborted) {
        setMessages((previousMessages) => {
          if (
            previousMessages.length === 0
          ) {
            return previousMessages;
          }

          const lastIndex =
            previousMessages.length - 1;

          const lastMessage =
            previousMessages[lastIndex];

          if (
            lastMessage.role !== "assistant"
          ) {
            return previousMessages;
          }

          /*
            If some response was already generated,
            retain it and add a stopped marker.
          */
          if (
            lastMessage.content.trim().length >
            0
          ) {
            return [
              ...previousMessages.slice(
                0,
                lastIndex,
              ),
              {
                ...lastMessage,
                content:
                  `${lastMessage.content}\n\n[Generation stopped]`,
              },
            ];
          }

          return [
            ...previousMessages.slice(
              0,
              lastIndex,
            ),
            {
              role: "assistant",
              content:
                "Generation was stopped.",
            },
          ];
        });

        return;
      }

      console.error(
        "[AIAdvisor] chat generation error:",
        error,
      );

      const friendlyError =
        error instanceof Error
          ? error.message
          : "Unknown generation error";

      setMessages((previousMessages) => {
        if (
          previousMessages.length === 0
        ) {
          return [
            {
              role: "assistant",
              content:
                "Unable to generate an AI response. Please try again.",
            },
          ];
        }

        const lastIndex =
          previousMessages.length - 1;

        const lastMessage =
          previousMessages[lastIndex];

        const errorText =
          `Unable to generate an AI response. Please try again.\n\n${friendlyError}`;

        if (
          lastMessage.role === "assistant"
        ) {
          return [
            ...previousMessages.slice(
              0,
              lastIndex,
            ),
            {
              role: "assistant",
              content: errorText,
            },
          ];
        }

        return [
          ...previousMessages,
          {
            role: "assistant",
            content: errorText,
          },
        ];
      });
    } finally {
      /*
        Only clear the controller if this request
        is still the currently active request.
      */
      if (
        abortRef.current === controller
      ) {
        abortRef.current = null;
      }

      setIsGenerating(false);
    }
  };

  /* ----------------------------------------------------------------
     Model selector
     ---------------------------------------------------------------- */

  const handleModelSelect = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const value = event.target.value;

    if (value === "__none__") {
      setSelectedModel(undefined);
      setConnectionStatus(
        "model_not_configured",
      );
      return;
    }

    setSelectedModel(value);
  };

  /* ----------------------------------------------------------------
     Render
     ---------------------------------------------------------------- */

  return (
    <section className="mx-auto max-w-4xl rounded-lg bg-card p-6 shadow">
      {/* ============================================================
          Header
          ============================================================ */}

      <header className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">
          AI Advisor
        </h1>

        <p className="text-muted-foreground">
          Get AI-powered operational insights for your restaurant.
        </p>
      </header>

      {/* ============================================================
          Ollama connection panel
          ============================================================ */}

      <div className="mb-6 rounded-md border bg-background p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-medium text-foreground">
            Ollama Service:
          </span>

          <span
            className={`font-medium ${
              connectionStatus ===
              "connected"
                ? "text-primary"
                : connectionStatus ===
                    "checking"
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
          ) : availableModels.length ===
            0 ? (
            <span className="text-sm text-destructive">
              No Ollama models available
            </span>
          ) : (
            <select
              id="ollama-model"
              value={
                selectedModel ??
                "__none__"
              }
              onChange={
                handleModelSelect
              }
              disabled={isGenerating}
              className="min-w-[260px] rounded border border-input bg-background px-3 py-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option
                value="__none__"
                disabled
              >
                -- select a model --
              </option>

              {availableModels.map(
                (model) => (
                  <option
                    key={model}
                    value={model}
                  >
                    {model}
                  </option>
                ),
              )}
            </select>
          )}
        </div>

        {connectionStatus ===
          "connected" &&
          selectedModel && (
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
            runConnectionCheck(
              selectedModel,
            )
          }
          disabled={
            connectionStatus ===
              "checking" ||
            isGenerating
          }
          className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {connectionStatus ===
          "checking"
            ? "Checking..."
            : "Check Connection"}
        </Button>
      </div>

      {/* ============================================================
          AI Context
          ============================================================ */}

      <div className="mb-6 rounded-md border bg-background p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-medium text-foreground">
            AI Context:
          </span>

          <span
            className={`font-medium ${
              contextStatus === "ready"
                ? "text-primary"
                : contextStatus ===
                    "loading"
                  ? "text-muted-foreground"
                  : "text-destructive"
            }`}
          >
            {contextStatus === "ready"
              ? "Ready"
              : contextStatus ===
                  "loading"
                ? "Loading..."
                : "Unavailable"}
          </span>
        </div>

        <Button
          type="button"
          onClick={() =>
            setPreviewOpen(
              (current) => !current,
            )
          }
          className="mt-2 bg-muted text-muted-foreground hover:bg-muted/80"
        >
          {previewOpen
            ? "Hide Context Preview"
            : "Show Context Preview"}
        </Button>

        {previewOpen && (
          <div className="mt-4 max-h-64 overflow-y-auto rounded border border-border bg-card p-3">
            {aiContext ? (
              <pre className="whitespace-pre-wrap text-xs text-foreground">
                {formatAIAdvisorContext(
                  aiContext,
                )}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground">
                No context available.
              </p>
            )}
          </div>
        )}

        <p className="mt-2 text-xs text-muted-foreground">
          Only the information shown here will be shared with the selected local AI model.
        </p>
      </div>

      {/* ============================================================
          Conversation
          ============================================================ */}

      <div className="flex flex-col gap-4">
        {/* ----------------------------------------------------------
            Messages
            ---------------------------------------------------------- */}

        <div className="min-h-[240px] max-h-[520px] overflow-y-auto rounded border bg-background p-4">
          {messages.length === 0 ? (
            <p className="text-muted-foreground">
              Ask TableFlow AI Advisor about your restaurant operations, bookings, no-shows, or customer enquiries.
            </p>
          ) : (
            messages.map(
              (message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className="mb-5"
                >
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {message.role ===
                    "user"
                      ? "You"
                      : "AI Advisor"}
                  </p>

                  <div className="whitespace-pre-wrap break-words text-foreground">
                    {message.content ||
                      (message.role ===
                        "assistant" &&
                      isGenerating
                        ? "Thinking..."
                        : "")}
                  </div>
                </div>
              ),
            )
          )}
        </div>

        {/* ----------------------------------------------------------
            Quick prompts
            ---------------------------------------------------------- */}

        <div className="flex flex-wrap gap-2">
          {quickPrompts.map(
            (prompt) => (
              <Button
                key={prompt}
                type="button"
                onClick={() =>
                  applyPrompt(prompt)
                }
                disabled={
                  isGenerating
                }
                className="bg-muted text-muted-foreground hover:bg-muted/80"
              >
                {prompt}
              </Button>
            ),
          )}
        </div>

        {/* ----------------------------------------------------------
            Input
            ---------------------------------------------------------- */}

        <textarea
          rows={4}
          placeholder="Enter your question here..."
          value={input}
          onChange={(event) =>
            setInput(
              event.target.value,
            )
          }
          disabled={isGenerating}
          className="w-full resize-y rounded-md border border-input bg-background p-3 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
        />

        {/* ----------------------------------------------------------
            Action buttons
            ---------------------------------------------------------- */}

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
            {isGenerating
              ? "Generating..."
              : "Send"}
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
            onClick={
              clearConversation
            }
            disabled={isGenerating}
            className="bg-muted text-muted-foreground hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Clear Conversation
          </Button>

          {isGenerating && (
            <span className="text-sm text-muted-foreground">
              AI Advisor is generating a response...
            </span>
          )}
        </div>

        {/* ----------------------------------------------------------
            Privacy / grounding note
            ---------------------------------------------------------- */}

        <p className="text-xs text-muted-foreground">
          Only relevant restaurant context will be shared with the selected local AI model when you submit a request.
        </p>
      </div>
    </section>
  );
}