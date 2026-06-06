import { describe, it, expect, vi, afterEach } from "vitest";
import { renderSummary } from "./render";
import type { Summary } from "../../lib/summarize";

const VIDEO_ID = "dQw4w9WgXcQ";

const summary: Summary = {
  language: "en",
  sections: [{ sec: 125, title: "Main bit", summary: "Great stuff." }],
};

function renderFirst(onSeek = vi.fn()): HTMLAnchorElement {
  const frag = renderSummary(summary, VIDEO_ID, onSeek);
  document.body.appendChild(frag);
  return document.body.querySelector(".timestamp") as HTMLAnchorElement;
}

describe("renderSummary — timestamp anchor", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("carries a real YouTube href with videoId and time", () => {
    const el = renderFirst();
    expect(el.href).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=125s");
  });

  it("left-click calls onSeek and prevents navigation", () => {
    const onSeek = vi.fn();
    const el = renderFirst(onSeek);

    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    el.dispatchEvent(event);

    expect(onSeek).toHaveBeenCalledWith(125);
    expect(event.defaultPrevented).toBe(true);
  });

  it("Cmd+click does not call onSeek (browser opens new tab)", () => {
    const onSeek = vi.fn();
    const el = renderFirst(onSeek);

    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      metaKey: true,
    });
    el.dispatchEvent(event);

    expect(onSeek).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("Ctrl+click does not call onSeek", () => {
    const onSeek = vi.fn();
    const el = renderFirst(onSeek);

    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
    });
    el.dispatchEvent(event);

    expect(onSeek).not.toHaveBeenCalled();
  });
});
