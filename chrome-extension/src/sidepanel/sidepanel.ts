import { summarize, type Summary } from "../../lib/summarize";
import { validateApiKey, canSummarize, type ValidateResult } from "../../lib/validate-api-key";
import { normalizeJson3 } from "../../lib/transcript";
import { renderSummary } from "./render";
import type { ContentRequest, TranscriptReply } from "../messages";

const DEFAULT_MODEL = "claude-opus-4-7";
const API_KEY_STORAGE = "anthropicApiKey";

let lastTestResult: ValidateResult | null = null;

const els = {
  summarize: document.getElementById("summarize") as HTMLButtonElement,
  apiKey: document.getElementById("api-key") as HTMLInputElement,
  keyRow: document.getElementById("key-row") as HTMLDetailsElement,
  testKey: document.getElementById("test-key") as HTMLButtonElement,
  keyStatus: document.getElementById("key-status") as HTMLSpanElement,
  status: document.getElementById("status") as HTMLParagraphElement,
  output: document.getElementById("output") as HTMLElement,
};

function applyKeyState(): void {
  const enabled = canSummarize(els.apiKey.value.trim(), lastTestResult);
  els.summarize.disabled = !enabled;
  if (!enabled) {
    setStatus("Add a valid API key to summarize.", true);
  }
}

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

async function runTestKey(): Promise<void> {
  const apiKey = els.apiKey.value.trim();
  if (!apiKey) {
    els.keyStatus.textContent = "Enter a key first.";
    els.keyStatus.className = "key-status error";
    return;
  }

  els.testKey.disabled = true;
  els.keyStatus.textContent = "Testing…";
  els.keyStatus.className = "key-status";

  const result = await validateApiKey(apiKey);
  lastTestResult = result;

  els.keyStatus.textContent = result.ok ? `✓ ${result.message}` : `✗ ${result.message}`;
  els.keyStatus.className = `key-status ${result.ok ? "success" : "error"}`;
  els.testKey.disabled = false;
  applyKeyState();
}

async function init(): Promise<void> {
  const stored = await chrome.storage.local.get(API_KEY_STORAGE);
  els.apiKey.value = (stored[API_KEY_STORAGE] as string) ?? "";
  applyKeyState();
  els.apiKey.addEventListener("change", () => {
    lastTestResult = null;
    void chrome.storage.local.set({ [API_KEY_STORAGE]: els.apiKey.value.trim() });
    applyKeyState();
  });
  els.testKey.addEventListener("click", () => void runTestKey());
  els.summarize.addEventListener("click", () => void run());
}

void init();
