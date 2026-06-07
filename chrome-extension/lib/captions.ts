/**
 * Returns true when the playerResponse advertises at least one caption track.
 * Use this to distinguish "no captions at all" from "captions exist but are
 * currently inaccessible" before attempting to fetch the transcript.
 */
export function hasCaptions(playerResponse: unknown): boolean {
  const tracks = (playerResponse as any)?.captions
    ?.playerCaptionsTracklistRenderer?.captionTracks;
  return Array.isArray(tracks) && tracks.length > 0;
}
