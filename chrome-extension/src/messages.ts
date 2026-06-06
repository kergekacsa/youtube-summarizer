/** Messages exchanged between the side panel and the content script. */
export type ContentRequest =
  | { type: "getPlayerResponse" }
  | { type: "seek"; sec: number };

export interface PlayerResponseReply {
  playerResponse: unknown | null;
}

export interface SeekReply {
  ok: boolean;
}

/** Window message posted from the MAIN-world script to the isolated bridge. */
export interface PlayerResponsePost {
  source: "yt-summarizer";
  type: "player-response";
  playerResponse: unknown;
}
