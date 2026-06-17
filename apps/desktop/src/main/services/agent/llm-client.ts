import type { AgentMessage, AgentRole } from "@jkauto/core";
import { AGENT_SYSTEM_PROMPT } from "./prompt";

interface ChatCompletionMessage {
  role: AgentRole;
  content: string;
}

interface ChatCompletionResponse {
  model?: string;
  choices?: Array<{
    message?: {
      role?: string;
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface AgentLlmResult {
  content: string;
  model?: string;
  usage?: ChatCompletionResponse["usage"];
}

const DEFAULT_BASE_URL = "http://127.0.0.1:20128/v1";
const DEFAULT_MODEL = "v1";
const DEFAULT_API_KEY = "sk-67abc7d002e1dde6-35cltj-04a78299";

export interface AgentConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

function getConfig(override?: Partial<AgentConfig>): AgentConfig {
  return {
    baseUrl:
      override?.baseUrl ||
      process.env.JKAUTO_AGENT_BASE_URL ||
      DEFAULT_BASE_URL,
    apiKey:
      override?.apiKey || process.env.JKAUTO_AGENT_API_KEY || DEFAULT_API_KEY,
    model: override?.model || process.env.JKAUTO_AGENT_MODEL || DEFAULT_MODEL,
  };
}

function alternateLocalBaseUrl(baseUrl: string): string | null {
  if (baseUrl.includes("://localhost:")) {
    return baseUrl.replace("://localhost:", "://127.0.0.1:");
  }
  if (baseUrl.includes("://127.0.0.1:")) {
    return baseUrl.replace("://127.0.0.1:", "://localhost:");
  }
  return null;
}

function isConnectionFailure(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const cause = (err as Error & { cause?: unknown }).cause;
  const code = (cause as { code?: unknown } | undefined)?.code;
  return err.message === "fetch failed" || code === "ECONNREFUSED";
}

async function postChatCompletion(
  baseUrl: string,
  apiKey: string,
  body: unknown,
): Promise<ChatCompletionResponse> {
  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => "");
    throw new Error(
      `Agent API failed (${response.status} ${response.statusText})${
        responseBody ? `: ${responseBody}` : ""
      }`,
    );
  }

  return (await response.json()) as ChatCompletionResponse;
}

export async function sendAgentChat(
  messages: AgentMessage[],
  contextSummary: string,
  configOverride?: Partial<AgentConfig>,
): Promise<AgentLlmResult> {
  const config = getConfig(configOverride);

  const llmMessages: ChatCompletionMessage[] = [
    { role: "system", content: AGENT_SYSTEM_PROMPT },
    {
      role: "system",
      content: `Current JKAuto app context:\n${contextSummary}`,
    },
    ...messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ];

  const body = {
    model: config.model,
    messages: llmMessages,
  };

  let data: ChatCompletionResponse;
  try {
    data = await postChatCompletion(config.baseUrl, config.apiKey, body);
  } catch (err) {
    const fallbackBaseUrl = alternateLocalBaseUrl(config.baseUrl);
    if (fallbackBaseUrl && isConnectionFailure(err)) {
      try {
        data = await postChatCompletion(fallbackBaseUrl, config.apiKey, body);
      } catch (fallbackErr) {
        throw new Error(
          `Cannot connect to JKAuto agent API at ${config.baseUrl} or ${fallbackBaseUrl}. ` +
            "Start the local OpenAI-compatible server on port 3000, or set JKAUTO_AGENT_BASE_URL.",
          { cause: fallbackErr },
        );
      }
    } else if (isConnectionFailure(err)) {
      throw new Error(
        `Cannot connect to JKAuto agent API at ${config.baseUrl}. ` +
          "Start the local OpenAI-compatible server, or set JKAUTO_AGENT_BASE_URL.",
        { cause: err },
      );
    } else {
      throw err;
    }
  }
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Agent API returned no assistant message");
  }

  return {
    content,
    model: data.model,
    usage: data.usage,
  };
}
