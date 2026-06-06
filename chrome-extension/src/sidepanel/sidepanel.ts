import { summarize, type Summary } from "../../lib/summarize";
import { normalizeJson3 } from "../../lib/transcript";
import { renderSummary } from "./render";
import type { ContentRequest, TranscriptReply } from "../messages";

// For this walking-skeleton slice the model is fixed and the key lives in a
// minimal field. Model selection and a real settings page are a later slice.
const DEFAULT_MODEL = "claude-opus-4-7";
const API_KEY_STORAGE = "anthropicApiKey";

const els = {
  summarize: document.getElementById("summarize") as HTMLButtonElement,
  apiKey: document.getElementById("api-key") as HTMLInputElement,
  keyRow: document.getElementById("key-row") as HTMLDetailsElement,
  status: document.getElementById("status") as HTMLParagraphElement,
  output: document.getElementById("output") as HTMLElement,
};

function setStatus(text: string, isError = false): void {
  els.status.textContent = text;
  els.status.classList.toggle("error", isError);
}

function isWatchUrl(url: string | undefined): boolean {
  return !!url && /^https?:\/\/www\.youtube\.com\/watch/.test(url);
}

async function activeTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function fetchTranscript(tabId: number): Promise<string> {
  const request: ContentRequest = { type: "getTranscript" };
  const reply = (await chrome.tabs
    .sendMessage(tabId, request)
    .catch(() => undefined)) as TranscriptReply | undefined;
  if (!reply) {
    throw new Error("Couldn't reach the YouTube page. Reload it and try again.");
  }
  if (reply.error || !reply.json3) {
    throw new Error(reply.error ?? "No transcript available for this video.");
  }
  return reply.json3;
}

async function run(): Promise<void> {
  els.output.replaceChildren();

  const apiKey = els.apiKey.value.trim();
  if (!apiKey) {
    els.keyRow.open = true;
    setStatus("Add your Anthropic API key to summarize.", true);
    return;
  }

  const tab = await activeTab();
  if (!tab?.id || !isWatchUrl(tab.url)) {
    setStatus("Open a YouTube video to summarize.", true);
    return;
  }
  const tabId = tab.id;

  els.summarize.disabled = true;
  try {
    setStatus("Fetching transcript…");
    const json3 = await fetchTranscript(tabId);
    const transcript = normalizeJson3(json3);

    setStatus(`Summarizing with ${DEFAULT_MODEL}…`);
    const summary: Summary = await summarize({
      transcript,
      model: DEFAULT_MODEL,
      apiKey,
    });

    setStatus(`${summary.sections.length} sections · ${summary.language}`);
    els.output.append(
      renderSummary(summary, (sec) => {
        const seek: ContentRequest = { type: "seek", sec };
        void chrome.tabs.sendMessage(tabId, seek).catch(() => undefined);
      }),
    );
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Something went wrong.", true);
  } finally {
    els.summarize.disabled = false;
  }
}

async function init(): Promise<void> {
  const stored = await chrome.storage.local.get(API_KEY_STORAGE);
  els.apiKey.value = (stored[API_KEY_STORAGE] as string) ?? "";
  els.apiKey.addEventListener("change", () => {
    void chrome.storage.local.set({ [API_KEY_STORAGE]: els.apiKey.value.trim() });
  });
  els.summarize.addEventListener("click", () => void run());
}

void init();
