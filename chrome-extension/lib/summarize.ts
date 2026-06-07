import Anthropic from "@anthropic-ai/sdk";
import schema from "../../shared/schema.json";
import promptText from "../../shared/prompt.md?raw";
import type { TranscriptSegment } from "./transcript";
import type { Chapter } from "./chapters";

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
  /** Creator-defined chapter markers, if any — see `extractChapters`. */
  chapters?: Chapter[] | null;
  model: string;
  apiKey: string;
}

export interface SummarizeDeps {
  createAnthropic?: (apiKey: string) => AnthropicLike;
  /** Injected in tests to avoid real timers. Defaults to setTimeout-based sleep. */
  sleep?: (ms: number) => Promise<void>;
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
    messages: [{ role: "user", content: renderUserMessage(input) }],
  });

  const summary = parseSummary(message.content);
  return snapTimestamps(summary, input.transcript.map((s) => s.sec));
}

function renderUserMessage(input: SummarizeInput): string {
  let message = "";

  if (input.chapters && input.chapters.length > 0) {
    const list = input.chapters.map((ch) => `[${ch.sec}] ${ch.title}`).join("\n");
    message += `Video chapters:\n\n${list}\n\n`;
  }

  const body = input.transcript.map((s) => `[${s.sec}] ${s.text}`).join("\n");
  message += `Summarize this video transcript:\n\n${body}`;
  return message;
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

export function snapTimestamps(summary: Summary, realSegmentStarts: number[]): Summary {
  const sorted = [...realSegmentStarts].sort((a, b) => a - b);
  return {
    ...summary,
    sections: summary.sections.map((section) => {
      // No segment ≤ sec (fabricated timestamp before the transcript starts): clamp to first.
      const snapped = findFloor(sorted, section.sec) ?? sorted[0];
      return snapped === section.sec ? section : { ...section, sec: snapped };
    }),
  };
}

function findFloor(sorted: number[], target: number): number | undefined {
  let result: number | undefined;
  for (const val of sorted) {
    if (val <= target) result = val;
    else break;
  }
  return result;
}

/**
 * Like `summarize`, but retries exactly once after a 2-second delay when
 * Anthropic returns a 429 (rate-limit). Any other error is rethrown immediately.
 */
export async function summarizeWithRetry(
  input: SummarizeInput,
  deps: SummarizeDeps = {},
): Promise<Summary> {
  const sleep = deps.sleep ?? defaultSleep;
  try {
    return await summarize(input, deps);
  } catch (err) {
    if (isHttpStatus(err, 429)) {
      await sleep(2000);
      return summarize(input, deps);
    }
    throw err;
  }
}

function isHttpStatus(err: unknown, status: number): boolean {
  return typeof (err as any)?.status === "number" && (err as any).status === status;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function defaultCreateAnthropic(apiKey: string): AnthropicLike {
  return new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  }) as unknown as AnthropicLike;
}
