import type {
  CaptureCommandPost,
  ContentRequest,
  PlayerResponseReply,
  SeekReply,
  TranscriptReply,
} from "../messages";

// Isolated-world bridge between the side panel and the page. Caches the player
// response, performs seeks, and obtains the transcript by asking the MAIN-world
// script to capture the player's authorized caption request.

const CAPTURE_TIMEOUT_MS = 9000;

let cachedPlayerResponse: unknown | null = null;
let onCapture: ((capture: { url: string; body: string }) => void) | null = null;

interface YtsPost {
  source?: string;
  type?: string;
  playerResponse?: unknown;
  url?: string;
  body?: string;
}

window.addEventListener("message", (event: MessageEvent) => {
  if (event.source !== window) return;
  const data = event.data as YtsPost | undefined;
  if (data?.source !== "yt-summarizer") return;

  if (data.type === "player-response") {
    cachedPlayerResponse = data.playerResponse ?? null;
  } else if (data.type === "transcript") {
    onCapture?.({ url: data.url ?? "", body: data.body ?? "" });
  }
});

function requestCapture(): Promise<{ url: string; body: string }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      onCapture = null;
      reject(
        new Error(
          "Timed out waiting for the caption track. Make sure the video has captions, then try again.",
        ),
      );
    }, CAPTURE_TIMEOUT_MS);
    onCapture = (capture) => {
      clearTimeout(timer);
      onCapture = null;
      resolve(capture);
    };
    const command: CaptureCommandPost = {
      source: "yt-summarizer-cmd",
      type: "capture-transcript",
    };
    window.postMessage(command, "*");
  });
}

function withJson3(url: string): string {
  try {
    const u = new URL(url, location.origin);
    u.searchParams.set("fmt", "json3");
    return u.toString();
  } catch {
    return `${url}${url.includes("?") ? "&" : "?"}fmt=json3`;
  }
}

async function obtainTranscriptJson3(): Promise<string> {
  const capture = await requestCapture();
  const body = capture.body.trim();

  // The player already handed us json3 — use it directly.
  if (body.startsWith("{")) return body;

  // Otherwise replay the authorized URL (it carries the pot token) forcing
  // json3, from this youtube.com origin with the user's session cookies.
  if (capture.url) {
    const res = await fetch(withJson3(capture.url), { credentials: "include" });
    return res.text();
  }
  return body;
}

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
    if (message.type === "getTranscript") {
      obtainTranscriptJson3()
        .then((json3) => sendResponse({ json3 } satisfies TranscriptReply))
        .catch((err: unknown) =>
          sendResponse({
            json3: null,
            error: err instanceof Error ? err.message : "Failed to get transcript",
          } satisfies TranscriptReply),
        );
      return true; // async response
    }
  },
);
