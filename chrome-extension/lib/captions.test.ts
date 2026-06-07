import { describe, it, expect } from "vitest";
import { hasCaptions } from "./captions";

describe("hasCaptions", () => {
  it("returns false when playerResponse is null", () => {
    expect(hasCaptions(null)).toBe(false);
  });

  it("returns false when playerResponse is missing the captions object", () => {
    expect(hasCaptions({})).toBe(false);
  });

  it("returns false when captionTracks is an empty array", () => {
    const playerResponse = {
      captions: {
        playerCaptionsTracklistRenderer: { captionTracks: [] },
      },
    };
    expect(hasCaptions(playerResponse)).toBe(false);
  });

  it("returns true when at least one caption track exists", () => {
    const playerResponse = {
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [{ baseUrl: "https://example.com/captions", languageCode: "en" }],
        },
      },
    };
    expect(hasCaptions(playerResponse)).toBe(true);
  });
});
