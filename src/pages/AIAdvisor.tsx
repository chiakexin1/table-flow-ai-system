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
   Defensive output formatter

   Ollama may occasionally return Markdown even when instructed not to.
   This keeps the UI clean and readable.
   ------------------------------------------------------------------ */

function formatAdvisorOutput(content: string): string {
  return content
    // Remove markdown bold
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")

    // Remove markdown headings
    .replace(/^#{1,6}\s+/gm, "")

    // Convert markdown bullets to a consistent bullet
    .replace(/^\s*[-*]\s+/gm, "• ")

    // Convert inline " - " sections into separate lines
    .replace(/\s+-\s+/g, "\n• ")

    // Remove markdown horizontal rules
    .replace(/^\s*---+\s*$/gm, "")

    // Remove markdown table separator rows
    .replace(/^\s*\|?[\s:|-]+\|?\s*$/gm, "")

    // Clean simple markdown table pipes
    .replace(/^\s*\|(.+)\|\s*$/gm, (_match, row: string) =>
      row
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean)
        .join(" • "),
    )

    // Avoid huge blank gaps
    .replace(/\n{3,}/g, "\n\n")

    .trim();
}

/* ------------------------------------------------------------------
   Connection status label
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
     Auth + booking state
     ---------------------------------------------------------------- */

  const { user } = useAuth();

  const {
    bookings,
    loading: bookingsLoading,
  } = useBooking();

  /* ----------------------------------------------------------------
     Ollama connection + model state
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
     Conversation state
     ---------------------------------------------------------------- */

  const [messages, setMessages] = useState<AdvisorMessage[]>([]);
  const [input, setInput] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);

  const [chatError, setChatError] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  /*
    Fixed conversation panel scroll container.
  */
  const conversationRef = useRef<HTMLDivElement | null>(null);

  /* ----------------------------------------------------------------
     System prompt builder
     ---------------------------------------------------------------- */

  const buildSystemPrompt = (context: AIAdvisorContext): string => {
    return `
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
- restaurant seating capacity
- sales
- menu information
- operating costs
- demand not explicitly shown in the context
- any other numeric value not explicitly available

4. Do NOT convert missing information into zero.

Example:
If revenue information is unavailable, do NOT say that revenue is RM0 or $0.

5. If factual information is unavailable, say exactly:

"This information is not available in the current restaurant context."

6. General operational advice is allowed.

7. General advice that is not directly supported by the supplied restaurant data must begin with:

"General recommendation:"

8. Never present general advice as an observed fact about this restaurant.

9. Do not invent a booking end time when only the booking start time is available.

10. Do not state a specific number of staff to schedule unless sufficient staffing and operational information exists in the context.

11. Do not interpret "max party size" as total restaurant seating capacity.

12. When analysing bookings:
- use exact counts and statuses from the supplied context
- distinguish known facts from recommendations
- do not invent additional bookings
- do not invent customers
- do not invent times or dates
- do not invent metrics

OUTPUT FORMAT RULES

Use clean plain text only.

Do NOT use:
- Markdown tables
- # headings
- ## headings
- ### headings
- **bold markdown**
- italic markdown
- code blocks

Use clear short section titles followed by a colon.

Preferred structure:

Today's Booking Analysis:

Booking Summary:
• Total bookings today: 0
• Confirmed: 0
• Pending: 0
• No-shows: 0

Key Observations:
• Observation one
• Observation two

General Recommendations:
• Recommendation one
• Recommendation two

Put every bullet on its own line.

Put one blank line between sections.

Keep answers concise, structured, practical, and easy to scan unless the user explicitly asks for more detail.

CURRENT RESTAURANT CONTEXT

${formatAIAdvisorContext(context)}
`.trim();
  };

  /* ----------------------------------------------------------------
     Load Ollama models
     ---------------------------------------------------------------- */

  const fetchModels = async () => {
    setModelsLoading(true);

    try {
      const models = await listOllamaModels();

      setAvailableModels(models);

      const storedModel = localStorage.getItem(
        LOCAL_STORAGE_KEY,
      );

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
      setConnectionStatus("model_not_configured");
    } catch (error) {
      console.error(
        "[AIAdvisor] model loading error:",
        error,
      );

      setAvailableModels([]);
      setSelectedModel(undefined);
      setConnectionStatus("offline");
    } finally {
      setModelsLoading(false);
    }
  };

  /* ----------------------------------------------------------------
     Ollama connection check
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
      setConnectionDetails(result.details);
    } catch (error) {
      console.error(
        "[AIAdvisor] connection check error:",
        error,
      );

      setConnectionStatus("offline");

      setConnectionDetails(
        error instanceof Error
          ? error.message
          : "Unknown connection error",
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
     Build AI context
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

      setContextStatus("unavailable");
      setAIContext(undefined);
    }
  };

  /* ----------------------------------------------------------------
     Initial model load
     ---------------------------------------------------------------- */

  useEffect(() => {
    fetchModels();
  }, []);

  /* ----------------------------------------------------------------
     Reset AI state when login user changes
     ---------------------------------------------------------------- */

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;

    setMessages([]);
    setInput("");
    setChatError(false);

    setPreviewOpen(false);
    setIsGenerating(false);

    setRestaurant(null);
    setAIContext(undefined);
    setContextStatus("loading");

    fetchRestaurant();
  }, [user]);

  /* ----------------------------------------------------------------
     Re-check Ollama when model changes
     ---------------------------------------------------------------- */

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

  /* ----------------------------------------------------------------
     Rebuild AI context
     ---------------------------------------------------------------- */

  useEffect(() => {
    buildContext();
  }, [
    restaurant,
    bookings,
    bookingsLoading,
  ]);

  /* ----------------------------------------------------------------
     Automatically scroll INSIDE conversation box

     The whole page does not keep extending downward.
     ---------------------------------------------------------------- */

  useEffect(() => {
    if (!conversationRef.current) {
      return;
    }

    conversationRef.current.scrollTop =
      conversationRef.current.scrollHeight;
  }, [messages, isGenerating]);

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
     Clear conversation
     ---------------------------------------------------------------- */

  const clearConversation = () => {
    abortRef.current?.abort();
    abortRef.current = null;

    setMessages([]);
    setInput("");
    setChatError(false);
    setIsGenerating(false);
  };

  /* ----------------------------------------------------------------
     Stop generation
     ---------------------------------------------------------------- */

  const stopGeneration = () => {
    abortRef.current?.abort();
    abortRef.current = null;

    setMessages((previousMessages) => {
      if (previousMessages.length === 0) {
        return previousMessages;
      }

      const lastIndex =
        previousMessages.length - 1;

      const lastMessage =
        previousMessages[lastIndex];

      if (lastMessage.role !== "assistant") {
        return previousMessages;
      }

      const existingContent =
        lastMessage.content.trim();

      const stoppedMessage =
        existingContent.length > 0
          ? `${lastMessage.content}\n\n[Generation stopped]`
          : "[Generation stopped]";

      return [
        ...previousMessages.slice(
          0,
          lastIndex,
        ),
        {
          ...lastMessage,
          content: stoppedMessage,
        },
      ];
    });

    /*
      User manually stopping is NOT treated as an application error.
    */
    setChatError(false);
    setIsGenerating(false);
  };

  /* ----------------------------------------------------------------
     Core streaming generator

     conversationForRequest MUST include the latest user message.
     ---------------------------------------------------------------- */

  const generateResponse = async (
    conversationForRequest: AdvisorMessage[],
  ) => {
    if (!aiContext || !selectedModel) {
      return;
    }

    const systemPrompt =
      buildSystemPrompt(aiContext);

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

    const controller =
      new AbortController();

    abortRef.current = controller;

    setIsGenerating(true);
    setChatError(false);

    let receivedChunk = false;

    try {
      await streamChat(
        ollamaMessages,
        selectedModel,

        (chunk: string) => {
          if (!chunk) {
            return;
          }

          receivedChunk = true;

          setMessages(
            (previousMessages) => {
              if (
                previousMessages.length ===
                0
              ) {
                return previousMessages;
              }

              const lastIndex =
                previousMessages.length - 1;

              const lastMessage =
                previousMessages[lastIndex];

              if (
                lastMessage.role !==
                "assistant"
              ) {
                return previousMessages;
              }

              return [
                ...previousMessages.slice(
                  0,
                  lastIndex,
                ),
                {
                  ...lastMessage,
                  content:
                    lastMessage.content +
                    chunk,
                },
              ];
            },
          );
        },

        controller,
      );

      /*
        Request completed but Ollama returned no content.
      */
      if (!receivedChunk) {
        setMessages(
          (previousMessages) => {
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
              lastMessage.role !==
                "assistant"
            ) {
              return previousMessages;
            }

            return [
              ...previousMessages.slice(
                0,
                lastIndex,
              ),
              {
                ...lastMessage,
                content:
                  "[Response interrupted]",
              },
            ];
          },
        );

        setChatError(true);
      }
    } catch (error: unknown) {
      const aborted =
        error instanceof DOMException &&
        error.name === "AbortError";

      /*
        Manual Stop Generation is already handled by stopGeneration().
        Do not add another error message.
      */
      if (aborted) {
        return;
      }

      console.error(
        "[AIAdvisor] chat generation error:",
        error,
      );

      setMessages(
        (previousMessages) => {
          if (
            previousMessages.length === 0
          ) {
            return [
              {
                role: "assistant",
                content:
                  "Unable to generate an AI response. Please check the Ollama connection and try again.",
              },
            ];
          }

          const lastIndex =
            previousMessages.length - 1;

          const lastMessage =
            previousMessages[lastIndex];

          if (
            lastMessage.role !==
              "assistant"
          ) {
            return [
              ...previousMessages,
              {
                role: "assistant",
                content:
                  "Unable to generate an AI response. Please check the Ollama connection and try again.",
              },
            ];
          }

          /*
            Preserve partially streamed text.
          */
          if (
            lastMessage.content.trim()
              .length > 0
          ) {
            return [
              ...previousMessages.slice(
                0,
                lastIndex,
              ),
              {
                ...lastMessage,
                content:
                  `${lastMessage.content}\n\n[Response interrupted]`,
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
                "Unable to generate an AI response. Please check the Ollama connection and try again.",
            },
          ];
        },
      );

      setChatError(true);
    } finally {
      if (
        abortRef.current === controller
      ) {
        abortRef.current = null;
      }

      setIsGenerating(false);
    }
  };

  /* ----------------------------------------------------------------
     Send rules
     ---------------------------------------------------------------- */

  const canSend =
    connectionStatus === "connected" &&
    Boolean(selectedModel) &&
    contextStatus === "ready" &&
    input.trim().length > 0 &&
    !isGenerating;

  /* ----------------------------------------------------------------
     Send
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
      Build request history BEFORE calling setMessages.

      This avoids React's async state problem and guarantees
      that the current question is included in the request.
    */
    const conversationForRequest = [
      ...messages,
      userMessage,
    ];

    setMessages([
      ...conversationForRequest,
      {
        role: "assistant",
        content: "",
      },
    ]);

    setInput("");
    setChatError(false);

    await generateResponse(
      conversationForRequest,
    );
  };

  /* ----------------------------------------------------------------
     Retry latest failed/interrupted response

     Does NOT duplicate the user message visually.
     ---------------------------------------------------------------- */

  const retryLast = async () => {
    if (
      isGenerating ||
      !aiContext ||
      !selectedModel ||
      connectionStatus !== "connected"
    ) {
      return;
    }

    /*
      Find latest user message.
    */
    let latestUserIndex = -1;

    for (
      let index = messages.length - 1;
      index >= 0;
      index -= 1
    ) {
      if (
        messages[index].role === "user"
      ) {
        latestUserIndex = index;
        break;
      }
    }

    if (latestUserIndex < 0) {
      return;
    }

    /*
      Keep everything through the latest user message,
      but discard the failed assistant response.
    */
    const conversationForRetry =
      messages.slice(
        0,
        latestUserIndex + 1,
      );

    setMessages([
      ...conversationForRetry,
      {
        role: "assistant",
        content: "",
      },
    ]);

    setChatError(false);

    await generateResponse(
      conversationForRetry,
    );
  };

  /* ----------------------------------------------------------------
     Model selection
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
          HEADER
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
          OLLAMA CONNECTION
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
            {statusLabel(
              connectionStatus,
            )}
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

        {/* Offline */}

        {connectionStatus ===
          "offline" && (
          <p className="mt-3 text-sm text-destructive">
            Unable to connect to the Ollama service. Make sure Ollama is running and try again.
          </p>
        )}

        {/* Timeout */}

        {connectionStatus ===
          "timeout" && (
          <p className="mt-3 text-sm text-destructive">
            Connection to Ollama timed out. Please try the connection check again.
          </p>
        )}

        {/* Missing model */}

        {connectionStatus ===
          "model_not_found" && (
          <p className="mt-3 text-sm text-destructive">
            The selected model is not available on this Ollama instance. Please choose another model.
          </p>
        )}

        {/* Model not configured */}

        {connectionStatus ===
          "model_not_configured" && (
          <p className="mt-3 text-sm text-destructive">
            Please select an Ollama model before using AI Advisor.
          </p>
        )}

        {connectionDetails &&
          connectionStatus !==
            "offline" && (
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
          AI CONTEXT
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
          <div className="mt-4 h-64 overflow-y-auto rounded-md border border-border bg-card p-3">
            {aiContext ? (
              <pre className="whitespace-pre-wrap break-words text-xs leading-5 text-foreground">
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
          CONVERSATION
          ============================================================ */}

      <div className="flex flex-col gap-4">
        {/* ----------------------------------------------------------
            FIXED HEIGHT OUTPUT BOX

            All conversation stays inside this box.
            The page does not become extremely long.
            ---------------------------------------------------------- */}

        <div
          ref={conversationRef}
          className="h-[420px] overflow-y-auto rounded-md border border-input bg-background p-4"
        >
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="max-w-xl text-center text-muted-foreground">
                Ask TableFlow AI Advisor about your restaurant operations, bookings, no-shows, or customer enquiries.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map(
                (message, index) => {
                  const isUser =
                    message.role ===
                    "user";

                  return (
                    <div
                      key={`${message.role}-${index}`}
                      className={`rounded-md border p-4 ${
                        isUser
                          ? "bg-muted/40"
                          : "bg-card"
                      }`}
                    >
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {isUser
                          ? "You"
                          : "AI Advisor"}
                      </div>

                      <div className="whitespace-pre-wrap break-words text-sm leading-7 text-foreground">
                        {message.content
                          ? isUser
                            ? message.content
                            : formatAdvisorOutput(
                                message.content,
                              )
                          : message.role ===
                                "assistant" &&
                              isGenerating
                            ? "Generating response..."
                            : ""}
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          )}
        </div>

        {/* ----------------------------------------------------------
            QUICK PROMPTS
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
                disabled={isGenerating}
                className="bg-muted text-muted-foreground hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {prompt}
              </Button>
            ),
          )}
        </div>

        {/* ----------------------------------------------------------
            INPUT
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
            ACTION BUTTONS
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

          {chatError &&
            !isGenerating && (
              <Button
                type="button"
                onClick={retryLast}
                disabled={
                  connectionStatus !==
                    "connected"
                }
                className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Retry
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
            PRIVACY NOTICE
            ---------------------------------------------------------- */}

        <p className="text-xs text-muted-foreground">
          Only relevant restaurant context will be shared with the selected local AI model when you submit a request.
        </p>
      </div>
    </section>
  );
}