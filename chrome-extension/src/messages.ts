/** Messages the side panel sends to the content script. */
export type ContentRequest =
  | { type: "getPlayerResponse" }
  | { type: "seek"; sec: number }
  | { type: "getTranscript" };

export interface PlayerResponseReply {
  playerResponse: unknown | null;
}

export interface SeekReply {
  ok: boolean;
}

/**
 * Reply to `getTranscript`: the raw json3 caption payload captured from (or
 * replayed via) the page's own authorized caption request, or an error.
 */
export interface TranscriptReply {
  json3: string | null;
  error?: string;
}

/** Window messages posted from the MAIN-world script to the isolated bridge. */
export interface PlayerResponsePost {
  source: "yt-summarizer";
  type: "player-response";
  playerResponse: unknown;
}

export interface TranscriptCapturePost {
  source: "yt-summarizer";
  type: "transcript";
  /** The authorized timedtext URL the player fetched (carries the pot token). */
  url: string;
  /** The response body the player received (json3, srv3/xml, etc.). */
  body: string;
}

/** Command posted from the isolated bridge to the MAIN-world script. */
export interface CaptureCommandPost {
  source: "yt-summarizer-cmd";
  type: "capture-transcript";
}
