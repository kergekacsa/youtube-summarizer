import { describe, it, expect } from "vitest";
import playerResponse from "../../shared/fixtures/synthetic/player-response.json";
import captionsJson3 from "../../shared/fixtures/synthetic/captions.json3.json";
import { extractTranscript } from "./transcript";

describe("extractTranscript", () => {
  it("fetches the caption track as json3 and returns normalized segments", async () => {
    const fetched: string[] = [];
    const fakeFetch = async (url: string) => {
      fetched.push(url);
      return new Response(JSON.stringify(captionsJson3));
    };

    const segments = await extractTranscript(playerResponse, { fetch: fakeFetch });

    // It requested the caption track's baseUrl with the json3 format.
    expect(fetched).toHaveLength(1);
    expect(fetched[0]).toBe(
      "https://example.test/api/timedtext?v=abc123&lang=en&fmt=json3",
    );

    // sec = floor(tStartMs/1000); multi-seg events are joined.
    expect(segments).toEqual([
      { sec: 0, text: "Hello world" },
      { sec: 3, text: "this is the second line" },
    ]);
  });
});
