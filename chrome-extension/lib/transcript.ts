/** One normalized line of the transcript. */
export interface TranscriptSegment {
  /** Segment start time in whole seconds (floor of tStartMs/1000). */
  sec: number;
  /** The spoken text of the segment, trimmed. */
  text: string;
}

/**
 * Normalize a YouTube json3 caption payload into {@link TranscriptSegment}s.
 *
 * The bytes come from the page's own (authorized) caption request — see the
 * content-script interceptor — not from a direct `baseUrl` fetch, which YouTube
 * now blocks without a proof-of-origin token.
 */
export function normalizeJson3(raw: string): TranscriptSegment[] {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error(
      "Caption track returned an empty response — the transcript may be unavailable for this video.",
    );
  }

  let json3: Json3;
  try {
    json3 = JSON.parse(trimmed) as Json3;
  } catch {
    throw new Error("Caption track response was not valid json3.");
  }

  return (json3.events ?? [])
    .map((event) => ({
      sec: Math.floor((event.tStartMs ?? 0) / 1000),
      text: (event.segs ?? [])
        .map((s) => s.utf8 ?? "")
        .join("")
        .trim(),
    }))
    .filter((segment) => segment.text !== "");
}

interface Json3 {
  events?: { tStartMs?: number; segs?: { utf8?: string }[] }[];
}
