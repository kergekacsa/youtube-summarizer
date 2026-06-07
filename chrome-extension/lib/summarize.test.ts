import { describe, it, expect } from "vitest";
import { summarize, summarizeWithRetry, snapTimestamps } from "./summarize";
import type { Summary } from "./summarize";
import type { TranscriptSegment } from "./transcript";
import type { Chapter } from "./chapters";

const REAL_STARTS = [0, 5, 10, 15];

describe("snapTimestamps", () => {
  it("snaps a fabricated sec to the nearest real segment ≤ it", () => {
    const summary: Summary = {
      language: "en",
      sections: [{ sec: 7, title: "T", summary: "S." }],
    };
    const snapped = snapTimestamps(summary, REAL_STARTS);
    expect(snapped.sections[0].sec).toBe(5);
  });

  it("leaves a sec that already matches a real segment unchanged", () => {
    const summary: Summary = {
      language: "en",
      sections: [{ sec: 10, title: "T", summary: "S." }],
    };
    const snapped = snapTimestamps(summary, REAL_STARTS);
    expect(snapped.sections[0].sec).toBe(10);
  });

  it("clamps to the first segment when sec is before all real starts", () => {
    const summary: Summary = {
      language: "en",
      sections: [{ sec: 0, title: "T", summary: "S." }],
    };
    const snapped = snapTimestamps(summary, [3, 6, 9]);
    expect(snapped.sections[0].sec).toBe(3);
  });
});

const TRANSCRIPT: TranscriptSegment[] = [
  { sec: 0, text: "Hello world" },
  { sec: 3, text: "this is the second line" },
];

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
      { transcript: TRANSCRIPT, model: "claude-opus-4-7", apiKey: "sk-test-key" },
      { createAnthropic },
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

  it("applies timestamp snapping after Claude's response", async () => {
    const summaryInput = {
      language: "en",
      sections: [{ sec: 7, title: "Intro", summary: "Two sentences. Here." }],
    };
    const createAnthropic = () => ({
      messages: {
        create: async () => ({
          content: [{ type: "tool_use", name: "submit_summary", input: summaryInput }],
        }),
      },
    });

    const result = await summarize(
      {
        transcript: [{ sec: 0, text: "start" }, { sec: 5, text: "next" }],
        model: "claude-opus-4-7",
        apiKey: "sk-test-key",
      },
      { createAnthropic },
    );

    expect(result.sections[0].sec).toBe(5);
  });

  it("includes the chapter list in the user message when chapters are provided", async () => {
    let captured: any;
    const createAnthropic = () => ({
      messages: {
        create: async (body: any) => {
          captured = body;
          return {
            content: [
              {
                type: "tool_use",
                name: "submit_summary",
                input: {
                  language: "en",
                  sections: [{ sec: 0, title: "T", summary: "S." }],
                },
              },
            ],
          };
        },
      },
    });

    const chapters: Chapter[] = [
      { sec: 0, title: "Intro" },
      { sec: 30, title: "Deep Dive" },
    ];

    await summarize(
      { transcript: TRANSCRIPT, chapters, model: "claude-opus-4-7", apiKey: "key" },
      { createAnthropic },
    );

    const userText = JSON.stringify(captured.messages);
    expect(userText).toContain("[0] Intro");
    expect(userText).toContain("[30] Deep Dive");
    // Transcript is still included.
    expect(userText).toContain("[0] Hello world");
  });

  it("omits the chapter preamble when chapters is null", async () => {

    let captured: any;
    const createAnthropic = () => ({
      messages: {
        create: async (body: any) => {
          captured = body;
          return {
            content: [
              {
                type: "tool_use",
                name: "submit_summary",
                input: {
                  language: "en",
                  sections: [{ sec: 0, title: "T", summary: "S." }],
                },
              },
            ],
          };
        },
      },
    });

    await summarize(
      { transcript: TRANSCRIPT, chapters: null, model: "claude-opus-4-7", apiKey: "key" },
      { createAnthropic },
    );

    const userText = JSON.stringify(captured.messages);
    expect(userText).not.toContain("chapters");
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
        { transcript: TRANSCRIPT, model: "claude-opus-4-7", apiKey: "sk-test-key" },
        { createAnthropic },
      ),
    ).rejects.toThrow(/submit_summary/);
  });
});

const OK_RESPONSE = {
  content: [
    {
      type: "tool_use",
      name: "submit_summary",
      input: { language: "en", sections: [{ sec: 0, title: "T", summary: "S." }] },
    },
  ],
};

function make429(): Error & { status: number } {
  const err = new Error("Rate limited") as Error & { status: number };
  err.status = 429;
  return err;
}

function make500(): Error & { status: number } {
  const err = new Error("Internal Server Error") as Error & { status: number };
  err.status = 500;
  return err;
}

describe("summarizeWithRetry", () => {
  it("returns the summary when the first attempt succeeds (no retry needed)", async () => {
    let calls = 0;
    const createAnthropic = () => ({
      messages: {
        create: async () => {
          calls++;
          return OK_RESPONSE;
        },
      },
    });
    const sleep = async (_ms: number) => {};

    const result = await summarizeWithRetry(
      { transcript: TRANSCRIPT, model: "test", apiKey: "key" },
      { createAnthropic, sleep },
    );

    expect(calls).toBe(1);
    expect(result.language).toBe("en");
  });

  it("retries once after exactly 2 s on a 429 and returns the summary if the retry succeeds", async () => {
    const sleepArgs: number[] = [];
    const sleep = async (ms: number) => { sleepArgs.push(ms); };

    let calls = 0;
    const createAnthropic = () => ({
      messages: {
        create: async () => {
          calls++;
          if (calls === 1) throw make429();
          return OK_RESPONSE;
        },
      },
    });

    const result = await summarizeWithRetry(
      { transcript: TRANSCRIPT, model: "test", apiKey: "key" },
      { createAnthropic, sleep },
    );

    expect(calls).toBe(2);
    expect(sleepArgs).toEqual([2000]);
    expect(result.language).toBe("en");
  });

  it("propagates the 429 error when the retry also fails", async () => {
    const sleep = async (_ms: number) => {};
    const createAnthropic = () => ({
      messages: { create: async () => { throw make429(); } },
    });

    await expect(
      summarizeWithRetry(
        { transcript: TRANSCRIPT, model: "test", apiKey: "key" },
        { createAnthropic, sleep },
      ),
    ).rejects.toMatchObject({ status: 429 });
  });

  it("does not retry on 5xx — throws immediately with no sleep", async () => {
    const sleepArgs: number[] = [];
    const sleep = async (ms: number) => { sleepArgs.push(ms); };

    let calls = 0;
    const createAnthropic = () => ({
      messages: {
        create: async () => {
          calls++;
          throw make500();
        },
      },
    });

    await expect(
      summarizeWithRetry(
        { transcript: TRANSCRIPT, model: "test", apiKey: "key" },
        { createAnthropic, sleep },
      ),
    ).rejects.toMatchObject({ status: 500 });

    expect(calls).toBe(1);
    expect(sleepArgs).toHaveLength(0);
  });
});
