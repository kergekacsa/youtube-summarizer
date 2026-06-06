import { describe, it, expect } from "vitest";
import { timestampUrl } from "./render-utils";

describe("timestampUrl", () => {
  it("generates a YouTube watch URL with videoId and seconds", () => {
    expect(timestampUrl("dQw4w9WgXcQ", 125)).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=125s",
    );
  });

  it("handles t=0 for the start of the video", () => {
    expect(timestampUrl("abc123", 0)).toBe(
      "https://www.youtube.com/watch?v=abc123&t=0s",
    );
  });
});
