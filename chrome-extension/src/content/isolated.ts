import type {
  ContentRequest,
  PlayerResponsePost,
  PlayerResponseReply,
  SeekReply,
} from "../messages";

// Isolated-world bridge: caches the player response posted by the MAIN-world
// script, answers the side panel's requests, and performs seeks on the <video>.

let cachedPlayerResponse: unknown | null = null;

window.addEventListener("message", (event: MessageEvent) => {
  if (event.source !== window) return;
  const data = event.data as Partial<PlayerResponsePost> | undefined;
  if (data?.source === "yt-summarizer" && data.type === "player-response") {
    cachedPlayerResponse = data.playerResponse ?? null;
  }
});

chrome.runtime.onMessage.addListener(
  (message: ContentRequest, _sender, sendResponse) => {
    if (message.type === "getPlayerResponse") {
      const reply: PlayerResponseReply = { playerResponse: cachedPlayerResponse };
      sendResponse(reply);
      return;
    }
    if (message.type === "seek") {
      const video = document.querySelector("video");
      if (video) video.currentTime = message.sec;
      const reply: SeekReply = { ok: !!video };
      sendResponse(reply);
      return;
    }
  },
);
