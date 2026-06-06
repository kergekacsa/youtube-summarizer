import type { Summary } from "../../lib/summarize";
import { timestampUrl } from "../../lib/render-utils";

/** Format whole seconds as `m:ss`, or `h:mm:ss` past an hour. */
export function formatTimestamp(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return hh > 0 ? `${hh}:${pad(mm)}:${pad(ss)}` : `${mm}:${pad(ss)}`;
}

/**
 * Render a Summary into DOM: one block per section with a clickable timestamp,
 * the title, and the summary text.
 *
 * The timestamp is an <a> whose href points to the timestamped YouTube URL so
 * middle-click / Cmd+click opens it in a new tab. A plain left-click still
 * seeks the current tab via `onSeek` without navigating.
 */
export function renderSummary(
  summary: Summary,
  videoId: string,
  onSeek: (sec: number) => void,
): DocumentFragment {
  const frag = document.createDocumentFragment();

  for (const section of summary.sections) {
    const wrap = document.createElement("div");
    wrap.className = "section";

    const head = document.createElement("div");
    head.className = "section-head";

    const timestamp = document.createElement("a");
    timestamp.className = "timestamp";
    timestamp.href = timestampUrl(videoId, section.sec);
    timestamp.textContent = formatTimestamp(section.sec);
    timestamp.addEventListener("click", (e) => {
      if (!e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onSeek(section.sec);
      }
    });

    const title = document.createElement("span");
    title.className = "section-title";
    title.textContent = section.title;

    head.append(timestamp, title);

    const summaryText = document.createElement("p");
    summaryText.className = "section-summary";
    summaryText.textContent = section.summary;

    wrap.append(head, summaryText);
    frag.append(wrap);
  }

  return frag;
}
