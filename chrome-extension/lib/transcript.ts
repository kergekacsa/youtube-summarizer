/** One normalized line of the transcript. */
export interface TranscriptSegment {
  /** Segment start time in whole seconds (floor of tStartMs/1000). */
  sec: number;
  /** The spoken text of the segment, trimmed. */
  text: string;
}

export interface ExtractTranscriptDeps {
  fetch: (url: string) => Promise<Response>;
}

/**
 * Read the caption-track URL out of a YouTube player response, fetch it as
 * json3, and normalize each caption event to a {@link TranscriptSegment}.
 */
export async function extractTranscript(
  playerResponse: unknown,
  deps: ExtractTranscriptDeps,
): Promise<TranscriptSegment[]> {
  const baseUrl = captionTrackUrl(playerResponse);
  const res = await deps.fetch(`${baseUrl}&fmt=json3`);
  const json3 = (await res.json()) as Json3;

  return (json3.events ?? [])
    .map((event) => ({
      sec: Math.floor(event.tStartMs / 1000),
      text: (event.segs ?? [])
        .map((s) => s.utf8 ?? "")
        .join("")
        .trim(),
    }))
    .filter((segment) => segment.text !== "");
}

function captionTrackUrl(playerResponse: unknown): string {
  const tracks = (playerResponse as PlayerResponse)?.captions
    ?.playerCaptionsTracklistRenderer?.captionTracks;
  const baseUrl = tracks?.[0]?.baseUrl;
  if (!baseUrl) {
    throw new Error("No caption track found in player response");
  }
  return baseUrl;
}

interface PlayerResponse {
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: { baseUrl?: string }[];
    };
  };
}

interface Json3 {
  events?: { tStartMs: number; segs?: { utf8?: string }[] }[];
}
