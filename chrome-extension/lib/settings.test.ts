import { describe, it, expect } from "vitest";
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from "./settings";
import type { StorageLike } from "./settings";

function makeStorage(initial: Record<string, unknown> = {}): StorageLike {
  const store = { ...initial };
  return {
    get: async (keys) => Object.fromEntries(keys.map((k) => [k, store[k]])),
    set: async (items) => {
      Object.assign(store, items);
    },
  };
}

describe("loadSettings", () => {
  it("returns defaults when storage is empty", async () => {
    const settings = await loadSettings(makeStorage());
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it("returns stored apiKey and model", async () => {
    const storage = makeStorage({
      settings: { apiKey: "sk-test", model: "claude-opus-4-7" },
    });
    const settings = await loadSettings(storage);
    expect(settings.apiKey).toBe("sk-test");
    expect(settings.model).toBe("claude-opus-4-7");
  });

  it("fills in defaults for missing fields", async () => {
    const storage = makeStorage({ settings: { apiKey: "sk-partial" } });
    const settings = await loadSettings(storage);
    expect(settings.apiKey).toBe("sk-partial");
    expect(settings.model).toBe(DEFAULT_SETTINGS.model);
  });
});

describe("saveSettings", () => {
  it("persists settings so loadSettings returns them", async () => {
    const storage = makeStorage();
    await saveSettings({ apiKey: "sk-saved", model: "claude-haiku-4-5-20251001" }, storage);
    const loaded = await loadSettings(storage);
    expect(loaded.apiKey).toBe("sk-saved");
    expect(loaded.model).toBe("claude-haiku-4-5-20251001");
  });
});
