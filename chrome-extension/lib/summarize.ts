import Anthropic from "@anthropic-ai/sdk";
import schema from "../../shared/schema.json";
import promptText from "../../shared/prompt.md?raw";
import type { TranscriptSegment } from "./transcript";

/** One section of the generated summary. */
export interface Section {
  /** Section start, in seconds — matches a real transcript-segment start time. */
  sec: number;
  title: string;
  summary: string;
}

/** The full structured output Claude produces. */
export interface Summary {
  /** ISO 639-1 code of the language Claude wrote in. */
  language: string;
  sections: Section[];
}

/** Minimal shape of the Anthropic client we depend on (for testability). */
export interface AnthropicLike {
  messages: {
    create(body: Record<string, unknown>): Promise<{ content: unknown[] }>;
  };
}

export interface SummarizeInput {
  /** Normalized transcript segments — see `normalizeJson3`. */
  transcript: TranscriptSegment[];
  model: string;
  apiKey: string;
}

export interface SummarizeDeps {
  createAnthropic?: (apiKey: string) => AnthropicLike;
}

const MAX_TOKENS = 4096;

/**
 * Orchestrate one summary: build the prompt from the transcript, force Claude
 * to call the `submit_summary` tool, and return the validated summary. How the
 * transcript bytes are obtained is the caller's concern.
 */
export async function summarize(
  input: SummarizeInput,
  deps: SummarizeDeps = {},
): Promise<Summary> {
  const createAnthropic = deps.createAnthropic ?? defaultCreateAnthropic;

  const client = createAnthropic(input.apiKey);
  const message = await client.messages.create({
    model: input.model,
    max_tokens: MAX_TOKENS,
    system: promptText,
    tools: [schema],
    tool_choice: { type: "tool", name: "submit_summary" },
    messages: [{ role: "user", content: renderTranscript(input.transcript) }],
  });

  return parseSummary(message.content);
}

function renderTranscript(segments: TranscriptSegment[]): string {
  const body = segments.map((s) => `[${s.sec}] ${s.text}`).join("\n");
  return `Summarize this video transcript:\n\n${body}`;
}

function parseSummary(content: unknown[]): Summary {
  const toolUse = content.find(
    (block): block is { type: "tool_use"; name: string; input: unknown } =>
      isToolUse(block) && block.name === "submit_summary",
  );
  if (!toolUse) {
    throw new Error("Claude did not call submit_summary");
  }
  return validateSummary(toolUse.input);
}

function isToolUse(
  block: unknown,
): block is { type: string; name: string; input: unknown } {
  return (
    typeof block === "object" &&
    block !== null &&
    (block as { type?: unknown }).type === "tool_use"
  );
}

function validateSummary(input: unknown): Summary {
  const value = input as Partial<Summary>;
  if (typeof value?.language !== "string") {
    throw new Error("submit_summary: missing language");
  }
  if (!Array.isArray(value.sections) || value.sections.length === 0) {
    throw new Error("submit_summary: sections must be a non-empty array");
  }
  for (const section of value.sections) {
    if (
      typeof section?.sec !== "number" ||
      typeof section?.title !== "string" ||
      typeof section?.summary !== "string"
    ) {
      throw new Error("submit_summary: malformed section");
    }
  }
  return value as Summary;
}

function defaultCreateAnthropic(apiKey: string): AnthropicLike {
  return new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  }) as unknown as AnthropicLike;
}
