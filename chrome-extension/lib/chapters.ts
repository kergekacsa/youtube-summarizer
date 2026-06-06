/** One chapter marker from a YouTube video. */
export interface Chapter {
  /** Chapter start time in whole seconds. */
  sec: number;
  title: string;
}

/**
 * Extract chapter markers from a YouTube player response, falling back to
 * description timestamp parsing when the player response has no chapters.
 * Returns null when neither source yields anything.
 */
export function extractChapters(
  playerResponse: unknown,
  description?: string,
): Chapter[] | null {
  const fromMarkers = extractFromMarkersMap(playerResponse);
  if (fromMarkers !== null) return fromMarkers;

  if (description) {
    return parseDescriptionChapters(description);
  }

  return null;
}

function extractFromMarkersMap(playerResponse: unknown): Chapter[] | null {
  const markersMap = getMarkersMap(playerResponse);
  if (!Array.isArray(markersMap)) return null;

  for (const entry of markersMap) {
    const chapters = (entry as any)?.value?.chapters;
    if (!Array.isArray(chapters) || chapters.length === 0) continue;

    const result: Chapter[] = [];
    for (const ch of chapters) {
      const renderer = (ch as any)?.chapterRenderer;
      const title: unknown = renderer?.title?.simpleText;
      const ms: unknown = renderer?.timeRangeStartMillis;
      if (typeof title === "string" && typeof ms === "number") {
        result.push({ sec: Math.floor(ms / 1000), title });
      }
    }
    if (result.length > 0) return result;
  }

  return null;
}

function getMarkersMap(playerResponse: unknown): unknown {
  return (playerResponse as any)
    ?.playerOverlays
    ?.playerOverlayRenderer
    ?.decoratedPlayerBarRenderer
    ?.decoratedPlayerBarRenderer
    ?.playerBar
    ?.multiMarkersPlayerBarRenderer
    ?.markersMap;
}

/**
 * Parse lines of the form `[H:]MM:SS Title` from a video description.
 * At least one `MM:SS` timestamp per line is required.
 */
function parseDescriptionChapters(description: string): Chapter[] | null {
  const pattern = /^(?:(\d+):)?(\d{1,2}):(\d{2})[ \t]+(.+)/gm;
  const chapters: Chapter[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(description)) !== null) {
    const [, hours, minutes, seconds, title] = match;
    const sec =
      (hours ? parseInt(hours, 10) : 0) * 3600 +
      parseInt(minutes, 10) * 60 +
      parseInt(seconds, 10);
    chapters.push({ sec, title: title.trim() });
  }

  return chapters.length > 0 ? chapters : null;
}
