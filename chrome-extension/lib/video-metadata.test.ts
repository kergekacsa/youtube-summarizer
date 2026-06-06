import { describe, it, expect } from "vitest";
import { parseVideoMetadata, formatDuration, formatTranscriptStep } from "./video-metadata";

describe("parseVideoMetadata", () => {
  it("extracts title and durationSec from a player response", () => {
    const playerResponse = {
      videoDetails: {
        title: "How to bake bread",
        lengthSeconds: "742",
      },
    };
    const result = parseVideoMetadata(playerResponse);
    expect(result).toEqual({ title: "How to bake bread", durationSec: 742 });
  });

  it("returns null for null input", () => {
    expect(parseVideoMetadata(null)).toBeNull();
  });

  it("returns null when videoDetails is missing", () => {
    expect(parseVideoMetadata({ streamingData: {} })).toBeNull();
  });

  it("returns null when lengthSeconds is not a string", () => {
    const playerResponse = { videoDetails: { title: "Video", lengthSeconds: 742 } };
    expect(parseVideoMetadata(playerResponse)).toBeNull();
  });
});

describe("formatDuration", () => {
  it("formats hours and minutes for ≥1h", () => {
    expect(formatDuration(3723)).toBe("1h 2m");
  });

  it("formats minutes only for <1h ≥1m", () => {
    expect(formatDuration(742)).toBe("12m");
  });

  it("formats seconds for <1m", () => {
    expect(formatDuration(30)).toBe("30s");
  });

  it("returns 0s for zero seconds", () => {
    expect(formatDuration(0)).toBe("0s");
  });
});

describe("formatTranscriptStep", () => {
  it("assembles the transcript substep label with plural segments", () => {
    expect(formatTranscriptStep(742, 42)).toBe("Fetched transcript (12m, 42 segments)");
  });

  it("uses singular for 1 segment", () => {
    expect(formatTranscriptStep(30, 1)).toBe("Fetched transcript (30s, 1 segment)");
  });
});
