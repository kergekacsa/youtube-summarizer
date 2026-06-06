import type { PlayerResponsePost } from "../messages";

// Runs in the page's MAIN world, so it can read window.ytInitialPlayerResponse —
// which an isolated content script cannot see. It relays the blob to the isolated
// bridge via window.postMessage.

function post(playerResponse: unknown): void {
  const message: PlayerResponsePost = {
    source: "yt-summarizer",
    type: "player-response",
    playerResponse,
  };
  window.postMessage(message, "*");
}

function readAndPost(): boolean {
  const pr = (window as unknown as { ytInitialPlayerResponse?: unknown })
    .ytInitialPlayerResponse;
  if (pr) {
    post(pr);
    return true;
  }
  return false;
}

// The blob may not be assigned yet at document_start — poll briefly.
if (!readAndPost()) {
  let tries = 0;
  const timer = setInterval(() => {
    if (readAndPost() || ++tries > 40) clearInterval(timer);
  }, 250);
}

// YouTube is a SPA; re-read when navigating between watch pages.
document.addEventListener("yt-navigate-finish", () => readAndPost());
