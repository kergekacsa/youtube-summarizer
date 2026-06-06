export interface VideoMetadata {
  title: string;
  durationSec: number;
}

export function parseVideoMetadata(playerResponse: unknown): VideoMetadata | null {
  const details = (playerResponse as { videoDetails?: unknown })?.videoDetails as
    | { title?: unknown; lengthSeconds?: unknown }
    | undefined;
  if (!details) return null;
  if (typeof details.title !== "string") return null;
  if (typeof details.lengthSeconds !== "string") return null;
  const durationSec = parseInt(details.lengthSeconds, 10);
  if (isNaN(durationSec)) return null;
  return { title: details.title, durationSec };
}

/** Format a whole-second count as a short human duration: "1h 2m", "12m", "30s". */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

/** Build the transcript substep label: "Fetched transcript (12m, 42 segments)". */
export function formatTranscriptStep(durationSec: number, segmentCount: number): string {
  const seg = segmentCount === 1 ? "1 segment" : `${segmentCount} segments`;
  return `Fetched transcript (${formatDuration(durationSec)}, ${seg})`;
}
