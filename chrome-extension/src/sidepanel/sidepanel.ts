import { summarize, type Summary } from "../../lib/summarize";
import { renderSummary } from "./render";
import type { ContentRequest, PlayerResponseReply } from "../messages";

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

async function getPlayerResponse(tabId: number): Promise<unknown | null> {
  const request: ContentRequest = { type: "getPlayerResponse" };
  for (let attempt = 0; attempt < 5; attempt++) {
    const reply = (await chrome.tabs
      .sendMessage(tabId, request)
      .catch(() => undefined)) as PlayerResponseReply | undefined;
    if (reply?.playerResponse) return reply.playerResponse;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return null;
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
    setStatus("Reading video metadata…");
    const playerResponse = await getPlayerResponse(tabId);
    if (!playerResponse) {
      setStatus("Couldn't read this video's data — reload the page and retry.", true);
      return;
    }

    setStatus(`Summarizing with ${DEFAULT_MODEL}…`);
    const summary: Summary = await summarize({
      playerResponse,
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
