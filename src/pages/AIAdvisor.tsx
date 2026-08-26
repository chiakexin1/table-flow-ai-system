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
   Clean Ollama output for display.

   The prompt already asks for plain text, but this formatter protects
   the UI if the model still returns markdown formatting.
   ------------------------------------------------------------------ */

function formatAdvisorOutput(content: string): string {
  return content
    // Remove markdown bold
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")

    // Remove markdown headings
    .replace(/^#{1,6}\s+/gm, "")

    // Convert markdown bullets to consistent bullets
    .replace(/^\s*[-*]\s+/gm, "• ")

    // Remove horizontal rules
    .replace(/^\s*---+\s*$/gm, "")

    // Remove markdown table separator rows
    .replace(/^\s*\|?[\s:|-]+\|?\s*$/gm, "")

    // Convert simple markdown table rows into readable text
    .replace(/^\s*\|(.+)\|\s*$/gm, (_match, row: string) =>
      row
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean)
        .join(" • "),
    )

    // Prevent excessive empty lines
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
   Main component
   ------------------------------------------------------------------ */

export default function AIAdvisor() {
  /* ----------------------------------------------------------------
     Auth + bookings
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

  const MODEL_STORAGE_KEY = "selectedOllamaModel";

  /* ----------------------------------------------------------------
     Restaurant + AI context
     ---------------------------------------------------------------- */

  const [restaurant, setRestaurant] = useState<any>(null);

  const [aiContext, setAIContext] = useState<
    AIAdvisorContext | undefined
  >();

  const [contextStatus, setContextStatus] = useState<
    "loading" | "ready" | "unavailable"
  >("loading");

  const [previewOpen, setPreviewOpen] = useState(false);

  /* ----------------------------------------------------------------
     Conversation
     ---------------------------------------------------------------- */

  const [messages, setMessages] = useState<AdvisorMessage[]>([]);
  const [input, setInput] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [chatError, setChatError] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  /*
    Used to scroll inside the conversation box.
  */
  const conversationRef = useRef<HTMLDivElement | null>(null);

  /*
    Prevent B4.7 from accidentally saving User A's messages into
    User B's storage during a user switch.

    sessionHydratedUserId means:
    "the conversation belonging to this user has already been loaded."
  */
  const [sessionHydratedUserId, setSessionHydratedUserId] = useState<
    string | null
  >(null);

  const conversationStorageKey = user?.id
    ? `tableflow-ai-conversation:${user.id}`
    : null;

  /* ----------------------------------------------------------------
     System prompt
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
- demand that is not explicitly present in the context
- any other numeric value that is not explicitly available

4. Do NOT convert unavailable information into zero.

For example:
If revenue data is unavailable, do NOT say revenue is RM0 or $0.

5. If factual information is unavailable, say exactly:

"This information is not available in the current restaurant context."

6. General operational advice is allowed.

7. Advice that is not directly supported by the restaurant data must begin with:

"General recommendation:"

8. Never present general advice as an observed fact about this restaurant.

9. Do not invent a booking end time when only a booking start time exists.

10. Do not state a specific number of staff to schedule unless sufficient staffing information exists.

11. Do not interpret max party size as total restaurant seating capacity.

12. When analysing bookings:
- use exact counts and statuses from the context
- distinguish known facts from recommendations
- do not invent bookings
- do not invent customers
- do not invent dates or times
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

Use short section titles followed by a colon.

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

Keep responses concise, structured, practical, and easy to scan unless the user asks for more detail.

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

      const storedModel = localStorage.getItem(MODEL_STORAGE_KEY);

      if (storedModel && models.includes(storedModel)) {
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
     Connection check
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
     Initial model loading
     ---------------------------------------------------------------- */

  useEffect(() => {
    fetchModels();
  }, []);

  /* ----------------------------------------------------------------
     User switch / logout handling

     Important:
     We reset the screen first, then the B4.7 restoration effect below
     loads the correct conversation belonging to the new user.
     ---------------------------------------------------------------- */

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;

    setMessages([]);
    setInput("");
    setChatError(false);
    setIsGenerating(false);

    setPreviewOpen(false);

    setRestaurant(null);
    setAIContext(undefined);
    setContextStatus("loading");

    /*
      Mark conversation as NOT restored yet.
    */
    setSessionHydratedUserId(null);

    if (user?.id) {
      fetchRestaurant();
    }
  }, [user?.id]);

  /* ----------------------------------------------------------------
     B4.7 — Restore the current authenticated user's conversation
     ---------------------------------------------------------------- */

  useEffect(() => {
    if (!user?.id || !conversationStorageKey) {
      setMessages([]);
      setSessionHydratedUserId(null);
      return;
    }

    try {
      const storedConversation =
        sessionStorage.getItem(conversationStorageKey);

      if (!storedConversation) {
        setMessages([]);
        setSessionHydratedUserId(user.id);
        return;
      }

      const parsed: unknown =
        JSON.parse(storedConversation);

      if (!Array.isArray(parsed)) {
        throw new Error(
          "Stored conversation is not an array",
        );
      }

      /*
        Accept only safe user/assistant text messages.
        Any malformed items are discarded.
      */
      const restoredMessages: AdvisorMessage[] =
        parsed.filter(
          (item: unknown): item is AdvisorMessage => {
            if (
              typeof item !== "object" ||
              item === null
            ) {
              return false;
            }

            const candidate = item as {
              role?: unknown;
              content?: unknown;
            };

            return (
              (candidate.role === "user" ||
                candidate.role === "assistant") &&
              typeof candidate.content === "string"
            );
          },
        );

      setMessages(restoredMessages);
      setSessionHydratedUserId(user.id);
    } catch (error) {
      console.warn(
        "[AIAdvisor] corrupted stored conversation discarded:",
        error,
      );

      sessionStorage.removeItem(
        conversationStorageKey,
      );

      setMessages([]);
      setSessionHydratedUserId(user.id);
    }
  }, [user?.id, conversationStorageKey]);

  /* ----------------------------------------------------------------
     B4.7 — Persist conversation

     Only runs AFTER the correct user's conversation has been restored.
     This prevents cross-user conversation leakage.
     ---------------------------------------------------------------- */

  useEffect(() => {
    if (
      !user?.id ||
      !conversationStorageKey ||
      sessionHydratedUserId !== user.id
    ) {
      return;
    }

    try {
      if (messages.length === 0) {
        sessionStorage.removeItem(
          conversationStorageKey,
        );
        return;
      }

      sessionStorage.setItem(
        conversationStorageKey,
        JSON.stringify(messages),
      );
    } catch (error) {
      console.warn(
        "[AIAdvisor] unable to persist conversation:",
        error,
      );
    }
  }, [
    messages,
    user?.id,
    conversationStorageKey,
    sessionHydratedUserId,
  ]);

  /* ----------------------------------------------------------------
     Selected model → save + re-check
     ---------------------------------------------------------------- */

  useEffect(() => {
    if (!selectedModel) {
      return;
    }

    localStorage.setItem(
      MODEL_STORAGE_KEY,
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
     Auto-scroll INSIDE conversation box
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

    /*
      Remove only the CURRENT authenticated user's saved conversation.
    */
    if (conversationStorageKey) {
      sessionStorage.removeItem(
        conversationStorageKey,
      );
    }

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

      /*
        Avoid duplicate stop markers.
      */
      if (
        lastMessage.content.includes(
          "[Generation stopped]",
        )
      ) {
        return previousMessages;
      }

      const existingContent =
        lastMessage.content.trim();

      const stoppedContent =
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
          content: stoppedContent,
        },
      ];
    });

    /*
      User stop is NOT an application error.
    */
    setChatError(false);
    setIsGenerating(false);
  };

  /* ----------------------------------------------------------------
     Core AI generation
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
        Ollama request completed but no assistant content arrived.
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
        Stop Generation already updates the UI.
        Do not append another error/stop message here.
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
            Preserve a partially generated response.
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
     Send enable/disable rules
     ---------------------------------------------------------------- */

  const canSend =
    connectionStatus === "connected" &&
    Boolean(selectedModel) &&
    contextStatus === "ready" &&
    input.trim().length > 0 &&
    !isGenerating;

  /* ----------------------------------------------------------------
     Send message
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
      Build history NOW.

      This ensures the current user question is included in the Ollama
      request and avoids stale React state.
    */
    const conversationForRequest = [
      ...messages,
      userMessage,
    ];

    /*
      UI gets the user message + empty assistant streaming placeholder.
    */
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
     Retry latest failed/interrupted assistant response

     Does NOT duplicate the user's message.
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
      Keep history through the latest user message and remove the
      failed assistant response.
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
          OLLAMA CONNECTION PANEL
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

        {/* Model unavailable */}

        {connectionStatus ===
          "model_not_found" && (
          <p className="mt-3 text-sm text-destructive">
            The selected model is not available on this Ollama instance. Please choose another model.
          </p>
        )}

        {/* No configured model */}

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
          AI CONTEXT PANEL
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
            Fixed-height conversation output box
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
                disabled={isGenerating}
                className="bg-muted text-muted-foreground hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {prompt}
              </Button>
            ),
          )}
        </div>

        {/* ----------------------------------------------------------
            User input
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
            Controls
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
            Privacy notice
            ---------------------------------------------------------- */}

        <p className="text-xs text-muted-foreground">
          Only relevant restaurant context will be shared with the selected local AI model when you submit a request.
        </p>
      </div>
    </section>
  );
}