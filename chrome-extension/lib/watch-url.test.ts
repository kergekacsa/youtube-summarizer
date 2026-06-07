import { describe, it, expect } from "vitest";
import { isWatchUrl } from "./watch-url";

describe("isWatchUrl", () => {
  it("returns true for a YouTube watch URL", () => {
    expect(isWatchUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
  });

  it("returns true for a watch URL with extra params", () => {
    expect(isWatchUrl("https://www.youtube.com/watch?v=abc&t=30s")).toBe(true);
  });

  it("returns false for the YouTube homepage", () => {
    expect(isWatchUrl("https://www.youtube.com/")).toBe(false);
  });

  it("returns false for a YouTube channel page", () => {
    expect(isWatchUrl("https://www.youtube.com/@SomeChannel")).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isWatchUrl(undefined)).toBe(false);
  });

  it("returns false for a non-YouTube URL", () => {
    expect(isWatchUrl("https://example.com/watch?v=foo")).toBe(false);
  });
});
