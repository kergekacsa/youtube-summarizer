import { summarizeWithRetry, type Summary } from "../../lib/summarize";
import { validateApiKey, canSummarize, type ValidateResult } from "../../lib/validate-api-key";
import { normalizeJson3 } from "../../lib/transcript";
import { extractChapters } from "../../lib/chapters";
import { hasCaptions } from "../../lib/captions";
import { isWatchUrl } from "../../lib/watch-url";
import { parseVideoMetadata, formatDuration, formatTranscriptStep } from "../../lib/video-metadata";
import { loadSettings, saveSettings, MODELS, type StorageLike } from "../../lib/settings";
import { getFromCache, saveToCache } from "../../lib/cache";
import { renderSummary } from "./render";
import type { ContentRequest, TranscriptReply, PlayerResponseReply } from "../messages";

const storage = chrome.storage.local as unknown as StorageLike;

let lastTestResult: ValidateResult | null = null;

const els = {
  summarize: document.getElementById("summarize") as HTMLButtonElement,
  settingsRow: document.getElementById("settings-row") as HTMLDetailsElement,
  apiKey: document.getElementById("api-key") as HTMLInputElement,
  testKey: document.getElementById("test-key") as HTMLButtonElement,
  keyStatus: document.getElementById("key-status") as HTMLSpanElement,
  model: document.getElementById("model") as HTMLSelectElement,
  status: document.getElementById("status") as HTMLParagraphElement,
  videoMeta: document.getElementById("video-meta") as HTMLParagraphElement,
  debugBlock: document.getElementById("debug-block") as HTMLDetailsElement,
  debugPre: document.getElementById("debug-pre") as HTMLPreElement,
  output: document.getElementById("output") as HTMLElement,
  regenerate: document.getElementById("regenerate") as HTMLButtonElement,
};

function applyKeyState(): void {
  const enabled = canSummarize(els.apiKey.value.trim(), lastTestResult);
  els.summarize.disabled = !enabled;
  if (!enabled) {
    setStatus("Add a valid API key in Settings to summarize.", true);
  } else {
    els.status.textContent = "";
    els.status.classList.remove("error");
  }
}

function setStatus(text: string, isError = false): void {
  els.status.textContent = text;
  els.status.classList.toggle("error", isError);
}

function showDebug(data: unknown): void {
  els.debugPre.textContent = JSON.stringify(data, null, 2);
  els.debugBlock.hidden = false;
}

function clearDebug(): void {
  els.debugBlock.hidden = true;
  els.debugPre.textContent = "";
}

function setStatusWithRetry(text: string): void {
  els.status.classList.add("error");
  const msg = document.createTextNode(text + " ");
  const btn = document.createElement("button");
  btn.textContent = "Retry";
  btn.className = "retry-btn";
  btn.addEventListener("click", () => void run());
  els.status.replaceChildren(msg, btn);
}

async function activeTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function fetchPlayerResponse(tabId: number): Promise<unknown> {
  const request: ContentRequest = { type: "getPlayerResponse" };
  const reply = (await chrome.tabs
    .sendMessage(tabId, request)
    .catch(() => undefined)) as PlayerResponseReply | undefined;
  return reply?.playerResponse ?? null;
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

async function run(force = false): Promise<void> {
  els.output.replaceChildren();
  els.videoMeta.textContent = "";
  els.videoMeta.hidden = true;
  els.regenerate.hidden = true;
  clearDebug();

  const apiKey = els.apiKey.value.trim();
  if (!apiKey) {
    els.settingsRow.open = true;
    setStatus("Add your Anthropic API key to summarize.", true);
    return;
  }

  const tab = await activeTab();
  if (!tab?.id || !isWatchUrl(tab.url)) {
    setStatus("Open a YouTube video to summarize.", true);
    return;
  }
  const tabId = tab.id;
  const videoId = new URL(tab.url!).searchParams.get("v") ?? "";
  const model = els.model.value;

  if (!force) {
    const cached = await getFromCache(videoId, model, "", storage);
    if (cached) {
      els.output.append(
        renderSummary(cached.summary, videoId, (sec) => {
          const seek: ContentRequest = { type: "seek", sec };
          void chrome.tabs.sendMessage(tabId, seek).catch(() => undefined);
        }),
      );
      setStatus(`${cached.summary.sections.length} sections · ${cached.summary.language}`);
      els.regenerate.hidden = false;
      applyKeyState();
      return;
    }
  }

  els.summarize.disabled = true;
  let runError: { message: string; retryable: boolean } | null = null;

  try {
    setStatus("Reading video metadata…");
    const playerResponse = await fetchPlayerResponse(tabId);

    if (!playerResponse) {
      showDebug({ error: "playerResponse is null — content script not ready or ytInitialPlayerResponse not yet available" });
      throw new Error("Could not read video data. Reload the page and try again.");
    }

    const meta = parseVideoMetadata(playerResponse);
    if (meta) {
      els.videoMeta.textContent = `${meta.title} (${formatDuration(meta.durationSec)})`;
      els.videoMeta.hidden = false;
    }

    const description = (playerResponse as any)?.videoDetails?.shortDescription as
      | string
      | undefined;
    const chapters = extractChapters(playerResponse, description);

    if (!hasCaptions(playerResponse)) {
      const pr = playerResponse as Record<string, unknown>;
      showDebug({
        topLevelKeys: Object.keys(pr),
        captions: pr["captions"] ?? null,
        videoId: (pr["videoDetails"] as any)?.videoId,
      });
      throw new Error("This video has no captions available.");
    }

    setStatus("Fetching transcript…");
    let json3: string;
    try {
      json3 = await fetchTranscript(tabId);
    } catch {
      throw new Error("Cannot access this video's transcript.");
    }

    const transcript = normalizeJson3(json3);
    const lastSec = transcript.length > 0 ? transcript[transcript.length - 1].sec : 0;
    setStatus(formatTranscriptStep(lastSec, transcript.length));

    setStatus(`Summarizing with ${model}…`);
    const summary: Summary = await summarizeWithRetry({ transcript, chapters, model, apiKey });

    setStatus("Validating timestamps…");
    await new Promise<void>((r) => setTimeout(r, 0));

    await saveToCache({ videoId, model, sectionPref: "", generatedAt: new Date().toISOString(), summary }, storage);

    els.output.append(
      renderSummary(summary, videoId, (sec) => {
        const seek: ContentRequest = { type: "seek", sec };
        void chrome.tabs.sendMessage(tabId, seek).catch(() => undefined);
      }),
    );
    setStatus(`${summary.sections.length} sections · ${summary.language}`);
    els.regenerate.hidden = false;
  } catch (err) {
    const httpStatus = (err as any)?.status;
    runError = {
      message: err instanceof Error ? err.message : "Something went wrong.",
      retryable: typeof httpStatus === "number" && httpStatus >= 500 && httpStatus < 600,
    };
  } finally {
    applyKeyState();
  }

  // Display error after applyKeyState() so it isn't overwritten by the key-state clear.
  if (runError) {
    if (runError.retryable) {
      setStatusWithRetry(runError.message);
    } else {
      setStatus(runError.message, true);
    }
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

async function persistSettings(): Promise<void> {
  await saveSettings({ apiKey: els.apiKey.value.trim(), model: els.model.value }, storage);
}

async function init(): Promise<void> {
  for (const m of MODELS) {
    const option = document.createElement("option");
    option.value = m.id;
    option.textContent = m.label;
    els.model.append(option);
  }

  const settings = await loadSettings(storage);
  els.apiKey.value = settings.apiKey;
  els.model.value = settings.model;
  applyKeyState();

  els.apiKey.addEventListener("change", () => {
    lastTestResult = null;
    void persistSettings();
    applyKeyState();
  });
  els.model.addEventListener("change", () => void persistSettings());
  els.testKey.addEventListener("click", () => void runTestKey());
  els.summarize.addEventListener("click", () => void run());
  els.regenerate.addEventListener("click", () => void run(true));
}

void init();
