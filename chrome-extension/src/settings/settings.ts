import { loadSettings, saveSettings, MODELS } from "../../lib/settings";
import type { StorageLike } from "../../lib/settings";
import { validateApiKey } from "../../lib/validate-api-key";

const storage = chrome.storage.local as unknown as StorageLike;

const els = {
  apiKey: document.getElementById("api-key") as HTMLInputElement,
  testKey: document.getElementById("test-key") as HTMLButtonElement,
  keyStatus: document.getElementById("key-status") as HTMLSpanElement,
  model: document.getElementById("model") as HTMLSelectElement,
  save: document.getElementById("save") as HTMLButtonElement,
  saveStatus: document.getElementById("save-status") as HTMLSpanElement,
};

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

  els.testKey.addEventListener("click", () => void runTestKey());
  els.save.addEventListener("click", () => void save());
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
  els.keyStatus.textContent = result.ok ? `✓ ${result.message}` : `✗ ${result.message}`;
  els.keyStatus.className = `key-status ${result.ok ? "success" : "error"}`;
  els.testKey.disabled = false;
}

async function save(): Promise<void> {
  await saveSettings({ apiKey: els.apiKey.value.trim(), model: els.model.value }, storage);
  els.saveStatus.textContent = "Saved.";
  els.saveStatus.className = "save-status success";
  setTimeout(() => {
    els.saveStatus.textContent = "";
  }, 2000);
}

void init();
