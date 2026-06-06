import { describe, it, expect } from "vitest";
import { extractChapters } from "./chapters";

function makePlayerResponseWithChapters(
  chapters: { title: string; timeRangeStartMillis: number }[],
) {
  return {
    playerOverlays: {
      playerOverlayRenderer: {
        decoratedPlayerBarRenderer: {
          decoratedPlayerBarRenderer: {
            playerBar: {
              multiMarkersPlayerBarRenderer: {
                markersMap: [
                  {
                    key: "AUTO_CHAPTERS",
                    value: {
                      chapters: chapters.map((ch) => ({
                        chapterRenderer: {
                          title: { simpleText: ch.title },
                          timeRangeStartMillis: ch.timeRangeStartMillis,
                        },
                      })),
                    },
                  },
                ],
              },
            },
          },
        },
      },
    },
  };
}

describe("extractChapters", () => {
  it("returns chapters from markersMap in the player response", () => {
    const playerResponse = makePlayerResponseWithChapters([
      { title: "Intro", timeRangeStartMillis: 0 },
      { title: "Main Topic", timeRangeStartMillis: 125000 },
      { title: "Wrap-up", timeRangeStartMillis: 605500 },
    ]);

    expect(extractChapters(playerResponse)).toEqual([
      { sec: 0, title: "Intro" },
      { sec: 125, title: "Main Topic" },
      { sec: 605, title: "Wrap-up" },
    ]);
  });

  it("falls back to description timestamp parsing when markersMap has no chapters", () => {
    const description =
      "Great video!\n\n0:00 Intro\n1:23 Main Section\n10:05 Conclusion";

    expect(extractChapters({}, description)).toEqual([
      { sec: 0, title: "Intro" },
      { sec: 83, title: "Main Section" },
      { sec: 605, title: "Conclusion" },
    ]);
  });

  it("parses hours in description timestamps", () => {
    const description = "1:00:00 Hour mark\n1:02:30 Later";

    expect(extractChapters({}, description)).toEqual([
      { sec: 3600, title: "Hour mark" },
      { sec: 3750, title: "Later" },
    ]);
  });

  it("returns null when neither markersMap nor description yields chapters", () => {
    expect(extractChapters({}, "Just a description with no timestamps.")).toBeNull();
    expect(extractChapters({})).toBeNull();
  });
});
