import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { normalizeJson3 } from "./transcript";
import { extractChapters } from "./chapters";
import { summarize } from "./summarize";
import type { AnthropicLike } from "./summarize";

const FIXTURES = fileURLToPath(new URL("../../shared/fixtures", import.meta.url));

function loadFixture(name: string) {
  const base = join(FIXTURES, name);
  return {
    playerResponse: JSON.parse(
      readFileSync(join(base, "player-response.json"), "utf-8"),
    ),
    captionsRaw: readFileSync(join(base, "captions.json3.json"), "utf-8"),
  };
}

function mockAnthropic(language: string, secs: number[]): () => AnthropicLike {
  const step = Math.max(1, Math.floor(secs.length / 4));
  const chosen = secs.filter((_, i) => i % step === 0).slice(0, 4);
  return () => ({
    messages: {
      create: async () => ({
        content: [
          {
            type: "tool_use",
            name: "submit_summary",
            input: {
              language,
              sections: chosen.map((sec, i) => ({
                sec,
                title: `Section ${i + 1}`,
                summary: "First sentence. Second sentence.",
              })),
            },
          },
        ],
      }),
    },
  });
}

function assertValidSummary(
  result: Awaited<ReturnType<typeof summarize>>,
  realSecs: Set<number>,
) {
  expect(result.sections.length).toBeGreaterThan(0);
  for (const section of result.sections) {
    expect(typeof section.title).toBe("string");
    expect(typeof section.summary).toBe("string");
    expect(
      realSecs.has(section.sec),
      `sec ${section.sec} not in transcript`,
    ).toBe(true);
  }
}

describe("pipeline integration – synthetic fixture (tracer bullet)", () => {
  it("yields valid Summary JSON with all secs matching transcript segments", async () => {
    const { playerResponse, captionsRaw } = loadFixture("synthetic");
    const transcript = normalizeJson3(captionsRaw);
    const chapters = extractChapters(playerResponse);
    const realSecs = new Set(transcript.map((s) => s.sec));

    const result = await summarize(
      { transcript, chapters, model: "claude-sonnet-4-6", apiKey: "sk-test" },
      { createAnthropic: mockAnthropic("en", transcript.map((s) => s.sec)) },
    );

    expect(result.language).toBe("en");
    assertValidSummary(result, realSecs);
  });
});

describe("pipeline integration – en-with-chapters fixture", () => {
  it("yields valid Summary JSON with all secs matching transcript segments", async () => {
    const { playerResponse, captionsRaw } = loadFixture("en-with-chapters");
    const transcript = normalizeJson3(captionsRaw);
    const chapters = extractChapters(playerResponse);
    const realSecs = new Set(transcript.map((s) => s.sec));

    const result = await summarize(
      { transcript, chapters, model: "claude-sonnet-4-6", apiKey: "sk-test" },
      { createAnthropic: mockAnthropic("en", transcript.map((s) => s.sec)) },
    );

    expect(result.language).toBe("en");
    assertValidSummary(result, realSecs);
  });

  it("extracts chapters from markersMap", () => {
    const { playerResponse } = loadFixture("en-with-chapters");
    const chapters = extractChapters(playerResponse);
    expect(chapters).not.toBeNull();
    expect(chapters!.length).toBeGreaterThanOrEqual(2);
    expect(chapters![0].sec).toBe(0);
  });
});

describe("pipeline integration – hu-no-chapters fixture", () => {
  it("yields valid Summary JSON with all secs matching transcript segments", async () => {
    const { playerResponse, captionsRaw } = loadFixture("hu-no-chapters");
    const transcript = normalizeJson3(captionsRaw);
    const chapters = extractChapters(playerResponse);
    const realSecs = new Set(transcript.map((s) => s.sec));

    const result = await summarize(
      { transcript, chapters, model: "claude-sonnet-4-6", apiKey: "sk-test" },
      { createAnthropic: mockAnthropic("hu", transcript.map((s) => s.sec)) },
    );

    expect(result.language).toBe("hu");
    assertValidSummary(result, realSecs);
  });

  it("extracts no chapters (returns null)", () => {
    const { playerResponse } = loadFixture("hu-no-chapters");
    const chapters = extractChapters(playerResponse);
    expect(chapters).toBeNull();
  });
});

describe("pipeline integration – en-long fixture", () => {
  it("handles a >1h transcript and yields valid Summary with correct secs", async () => {
    const { playerResponse, captionsRaw } = loadFixture("en-long");
    const transcript = normalizeJson3(captionsRaw);
    const chapters = extractChapters(playerResponse);
    const realSecs = new Set(transcript.map((s) => s.sec));

    expect(transcript[transcript.length - 1].sec).toBeGreaterThan(3600);

    const result = await summarize(
      { transcript, chapters, model: "claude-sonnet-4-6", apiKey: "sk-test" },
      { createAnthropic: mockAnthropic("en", transcript.map((s) => s.sec)) },
    );

    expect(result.language).toBe("en");
    assertValidSummary(result, realSecs);
  });
});
