import { describe, it, expect } from "vitest";
import playerResponse from "../../shared/fixtures/synthetic/player-response.json";
import captionsJson3 from "../../shared/fixtures/synthetic/captions.json3.json";
import { summarize } from "./summarize";

function fakeFetch() {
  return async () => new Response(JSON.stringify(captionsJson3));
}

describe("summarize", () => {
  it("forces the submit_summary tool and returns the parsed summary", async () => {
    let captured: any;
    const summaryInput = {
      language: "en",
      sections: [{ sec: 0, title: "Intro", summary: "Two sentences. Here." }],
    };
    const createAnthropic = (apiKey: string) => {
      expect(apiKey).toBe("sk-test-key");
      return {
        messages: {
          create: async (body: any) => {
            captured = body;
            return {
              content: [
                { type: "tool_use", name: "submit_summary", input: summaryInput },
              ],
            };
          },
        },
      };
    };

    const result = await summarize(
      { playerResponse, model: "claude-opus-4-7", apiKey: "sk-test-key" },
      { createAnthropic, fetch: fakeFetch() },
    );

    // Returns the validated summary from the tool call.
    expect(result).toEqual(summaryInput);

    // Called the chosen model.
    expect(captured.model).toBe("claude-opus-4-7");

    // Forced Claude to call submit_summary.
    expect(captured.tool_choice).toEqual({ type: "tool", name: "submit_summary" });
    expect(captured.tools.map((t: any) => t.name)).toContain("submit_summary");

    // The transcript was rendered into the user message with [sec] prefixes.
    const userText = JSON.stringify(captured.messages);
    expect(userText).toContain("[0] Hello world");
    expect(userText).toContain("[3] this is the second line");
  });

  it("throws when Claude returns no submit_summary tool call", async () => {
    const createAnthropic = () => ({
      messages: {
        create: async () => ({
          content: [{ type: "text", text: "I won't use the tool." }],
        }),
      },
    });

    await expect(
      summarize(
        { playerResponse, model: "claude-opus-4-7", apiKey: "sk-test-key" },
        { createAnthropic, fetch: fakeFetch() },
      ),
    ).rejects.toThrow(/submit_summary/);
  });
});
