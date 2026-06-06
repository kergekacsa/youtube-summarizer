import { summarize, type Summary } from "../../lib/summarize";
import { normalizeJson3 } from "../../lib/transcript";
import { extractChapters } from "../../lib/chapters";
import { parseVideoMetadata, formatDuration, formatTranscriptStep } from "../../lib/video-metadata";
import { loadSettings, DEFAULT_SETTINGS, type Settings, type StorageLike } from "../../lib/settings";
import { renderSummary } from "./render";
import type { ContentRequest, TranscriptReply, PlayerResponseReply } from "../messages";

const storage = chrome.storage.local as unknown as StorageLike;

let settings: Settings = DEFAULT_SETTINGS;

const els = {
  summarize: document.getElementById("summarize") as HTMLButtonElement,
  settingsBtn: document.getElementById("settings-btn") as HTMLButtonElement,
  noKey: document.getElementById("no-key") as HTMLParagraphElement,
  openSettings: document.getElementById("open-settings") as HTMLAnchorElement,
  status: document.getElementById("status") as HTMLParagraphElement,
  videoMeta: document.getElementById("video-meta") as HTMLParagraphElement,
  output: document.getElementById("output") as HTMLElement,
};

function applyKeyState(): void {
  const hasKey = settings.apiKey.length > 0;
  els.summarize.disabled = !hasKey;
  els.noKey.hidden = hasKey;
  if (hasKey) {
    els.status.textContent = "";
    els.status.classList.remove("error");
  }
}

function setStatus(text: string, isError = false): void {
  els.status.textContent = text;
  els.status.classList.toggle("error", isError);
}

function openSettings(): void {
  void chrome.runtime.openOptionsPage();
}

function isWatchUrl(url: string | undefined): boolean {
  return !!url && /^https?:\/\/www\.youtube\.com\/watch/.test(url);
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

async function run(): Promise<void> {
  els.output.replaceChildren();
  els.videoMeta.textContent = "";
  els.videoMeta.hidden = true;

  const { apiKey, model } = settings;
  if (!apiKey) {
    setStatus("Add your API key in settings to summarize.", true);
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
    const playerResponse = await fetchPlayerResponse(tabId);
    const meta = parseVideoMetadata(playerResponse);
    if (meta) {
      els.videoMeta.textContent = `${meta.title} (${formatDuration(meta.durationSec)})`;
      els.videoMeta.hidden = false;
    }

    const description = (playerResponse as any)?.videoDetails?.shortDescription as
      | string
      | undefined;
    const chapters = extractChapters(playerResponse, description);

    setStatus("Fetching transcript…");
    const json3 = await fetchTranscript(tabId);
    const transcript = normalizeJson3(json3);
    const lastSec = transcript.length > 0 ? transcript[transcript.length - 1].sec : 0;
    setStatus(formatTranscriptStep(lastSec, transcript.length));

    setStatus(`Summarizing with ${model}…`);
    const summary: Summary = await summarize({ transcript, chapters, model, apiKey });

    setStatus("Validating timestamps…");
    await new Promise<void>((r) => setTimeout(r, 0));

    els.output.append(
      renderSummary(summary, (sec) => {
        const seek: ContentRequest = { type: "seek", sec };
        void chrome.tabs.sendMessage(tabId, seek).catch(() => undefined);
      }),
    );
    setStatus(`${summary.sections.length} sections · ${summary.language}`);
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Something went wrong.", true);
  } finally {
    applyKeyState();
  }
}

async function init(): Promise<void> {
  settings = await loadSettings(storage);
  applyKeyState();

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local" && changes["settings"]) {
      const next = changes["settings"].newValue as Partial<Settings> | undefined;
      settings = {
        apiKey: typeof next?.apiKey === "string" ? next.apiKey : DEFAULT_SETTINGS.apiKey,
        model: typeof next?.model === "string" ? next.model : DEFAULT_SETTINGS.model,
      };
      applyKeyState();
    }
  });

  els.settingsBtn.addEventListener("click", openSettings);
  els.openSettings.addEventListener("click", (e) => {
    e.preventDefault();
    openSettings();
  });
  els.summarize.addEventListener("click", () => void run());
}

void init();
