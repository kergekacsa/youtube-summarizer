import { describe, it, expect } from "vitest";
import captionsJson3 from "../../shared/fixtures/synthetic/captions.json3.json";
import { normalizeJson3 } from "./transcript";

describe("normalizeJson3", () => {
  it("normalizes a json3 payload into floor-second segments", () => {
    const segments = normalizeJson3(JSON.stringify(captionsJson3));

    // sec = floor(tStartMs/1000); multi-seg events are joined; empties dropped.
    expect(segments).toEqual([
      { sec: 0, text: "Hello world" },
      { sec: 3, text: "this is the second line" },
    ]);
  });

  it("throws a legible error when the payload is empty", () => {
    expect(() => normalizeJson3("")).toThrow(/empty/i);
  });

  it("throws when the payload is not valid json3", () => {
    expect(() => normalizeJson3("<xml>not json</xml>")).toThrow(/json3/i);
  });
});
