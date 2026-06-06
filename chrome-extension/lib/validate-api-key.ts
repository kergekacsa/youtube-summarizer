import Anthropic from "@anthropic-ai/sdk";
import type { AnthropicLike } from "./summarize";

export interface ValidateResult {
  ok: boolean;
  message: string;
}

/**
 * Returns whether the summarize action should be available.
 * An untested key (null) is treated as potentially valid — we don't block upfront.
 */
export function canSummarize(apiKey: string, lastTest: ValidateResult | null): boolean {
  if (!apiKey) return false;
  if (lastTest !== null && !lastTest.ok) return false;
  return true;
}

export interface ValidateDeps {
  createAnthropic?: (apiKey: string) => AnthropicLike;
}

export async function validateApiKey(
  apiKey: string,
  deps: ValidateDeps = {},
): Promise<ValidateResult> {
  const createAnthropic = deps.createAnthropic ?? defaultCreateAnthropic;
  const client = createAnthropic(apiKey);

  try {
    await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1,
      messages: [{ role: "user", content: "hi" }],
    });
    return { ok: true, message: "API key is valid." };
  } catch (err) {
    if (isHttpError(err) && err.status === 401) {
      return {
        ok: false,
        message: "Invalid API key. Check it and try again.",
      };
    }
    return { ok: false, message: "Couldn't reach Anthropic. Check your connection." };
  }
}

function isHttpError(err: unknown): err is { status: number } {
  return typeof err === "object" && err !== null && "status" in err;
}

function defaultCreateAnthropic(apiKey: string): AnthropicLike {
  return new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  }) as unknown as AnthropicLike;
}
