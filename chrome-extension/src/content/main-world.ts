import type {
  CaptureCommandPost,
  PlayerResponsePost,
  TranscriptCapturePost,
} from "../messages";

// Runs in the page's MAIN world. Two jobs:
//   1. Relay window.ytInitialPlayerResponse to the isolated bridge.
//   2. Intercept the YouTube player's own (authorized, pot-bearing) caption
//      request — a direct timedtext fetch returns empty without that token, so
//      we let the genuine player fetch it and read along.

const LOG = "[yt-summarizer]";
const TIMEDTEXT = "/api/timedtext";

// --- 1. Player response ----------------------------------------------------

function postPlayerResponse(playerResponse: unknown): void {
  const message: PlayerResponsePost = {
    source: "yt-summarizer",
    type: "player-response",
    playerResponse,
  };
  window.postMessage(message, "*");
}

function readAndPostPlayerResponse(): boolean {
  const pr = (window as unknown as { ytInitialPlayerResponse?: unknown })
    .ytInitialPlayerResponse;
  if (pr) {
    postPlayerResponse(pr);
    return true;
  }
  return false;
}

if (!readAndPostPlayerResponse()) {
  let tries = 0;
  const timer = setInterval(() => {
    if (readAndPostPlayerResponse() || ++tries > 40) clearInterval(timer);
  }, 250);
}
document.addEventListener("yt-navigate-finish", () => readAndPostPlayerResponse());

// --- 2. Caption interception ----------------------------------------------

let lastCapture: { url: string; body: string } | null = null;
let weEnabledCaptions = false;

function isTimedText(url: string | undefined): url is string {
  return !!url && url.includes(TIMEDTEXT);
}

function postCapture(): void {
  if (!lastCapture) return;
  const message: TranscriptCapturePost = {
    source: "yt-summarizer",
    type: "transcript",
    url: lastCapture.url,
    body: lastCapture.body,
  };
  window.postMessage(message, "*");
  restoreCaptions();
}

function recordCapture(url: string, body: string): void {
  console.debug(`${LOG} captured timedtext`, { url, bytes: body.length });
  lastCapture = { url, body };
  postCapture();
}

// Patch fetch (the modern player uses it).
const originalFetch = window.fetch;
window.fetch = function patchedFetch(
  this: typeof window,
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : (input as Request).url;
  const promise = originalFetch.call(this, input as RequestInfo, init);
  if (isTimedText(url)) {
    promise
      .then((res) =>
        res
          .clone()
          .text()
          .then((body) => recordCapture(url, body)),
      )
      .catch(() => undefined);
  }
  return promise;
} as typeof window.fetch;

// Patch XHR (older code paths / fallback).
const originalOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function patchedOpen(
  this: XMLHttpRequest & { __ytsUrl?: string },
  method: string,
  url: string | URL,
  ...rest: unknown[]
) {
  this.__ytsUrl = typeof url === "string" ? url : url.href;
  // @ts-expect-error variadic passthrough to the native signature
  return originalOpen.call(this, method, url, ...rest);
} as typeof XMLHttpRequest.prototype.open;

const originalSend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.send = function patchedSend(
  this: XMLHttpRequest & { __ytsUrl?: string },
  body?: Document | XMLHttpRequestBodyInit | null,
) {
  const url = this.__ytsUrl;
  if (isTimedText(url)) {
    this.addEventListener("load", () => {
      try {
        recordCapture(url, this.responseText);
      } catch {
        /* responseType may not be text */
      }
    });
  }
  return originalSend.call(this, body);
} as typeof XMLHttpRequest.prototype.send;

// --- Trigger the player to fetch a caption track on demand -----------------

// Clicking the real CC button is what reliably makes the player fetch the
// caption track (the semi-documented player.setOption API proved flaky). It
// replicates exactly what a user toggling captions does.

function ccButton(): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>(".ytp-subtitles-button");
}

function captionsOn(btn: HTMLButtonElement): boolean {
  return btn.getAttribute("aria-pressed") === "true";
}

function triggerCaptions(): void {
  const btn = ccButton();
  if (btn && btn.getAttribute("aria-disabled") !== "true") {
    if (captionsOn(btn)) {
      // Already on but nothing captured yet — toggle off→on to force a fresh
      // fetch the interceptor can catch. Leave them on afterward (user's state).
      console.debug(`${LOG} captions on; toggling to force a fetch`);
      btn.click();
      setTimeout(() => btn.click(), 400);
    } else {
      console.debug(`${LOG} enabling captions via CC button`);
      btn.click();
      weEnabledCaptions = true; // we turned them on — restore off after capture
    }
    return;
  }

  // Fallback: the player API (no CC button, e.g. minimal/embedded chrome).
  const player = getPlayer();
  if (!player?.getOption) {
    console.warn(`${LOG} no CC button and player API unavailable`);
    return;
  }
  try {
    player.loadModule?.("captions");
    const tracklist =
      (player.getOption("captions", "tracklist") as unknown[]) ?? [];
    console.debug(`${LOG} caption tracks available`, tracklist.length);
    if (tracklist.length) {
      player.setOption?.("captions", "track", tracklist[0]);
      weEnabledCaptions = true;
    }
  } catch (err) {
    console.error(`${LOG} triggerCaptions fallback failed`, err);
  }
}

function getPlayer(): {
  getOption?: (m: string, o: string) => unknown;
  setOption?: (m: string, o: string, v: unknown) => void;
  loadModule?: (m: string) => void;
} | null {
  return document.getElementById("movie_player") as never;
}

function restoreCaptions(): void {
  if (!weEnabledCaptions) return;
  weEnabledCaptions = false;
  setTimeout(() => {
    const btn = ccButton();
    if (btn && captionsOn(btn)) {
      btn.click();
    } else {
      try {
        getPlayer()?.setOption?.("captions", "track", {});
      } catch {
        /* best-effort */
      }
    }
  }, 500);
}

window.addEventListener("message", (event: MessageEvent) => {
  if (event.source !== window) return;
  const data = event.data as Partial<CaptureCommandPost> | undefined;
  if (data?.source === "yt-summarizer-cmd" && data.type === "capture-transcript") {
    if (lastCapture) postCapture();
    else triggerCaptions();
  }
});
