import { describe, it, expect } from "vitest";
import { cacheKey, getFromCache, saveToCache, type CacheEntry, type CacheStorageLike } from "./cache";
import type { Summary } from "./summarize";

function makeStorage(initial: Record<string, unknown> = {}): CacheStorageLike {
  const store = { ...initial };
  return {
    get: async (keys) => Object.fromEntries(keys.map((k) => [k, store[k]])),
    set: async (items) => {
      Object.assign(store, items);
    },
  };
}

const SUMMARY: Summary = {
  language: "en",
  sections: [{ sec: 0, title: "Intro", summary: "Hello world." }],
};

function makeEntry(overrides: Partial<CacheEntry> = {}): CacheEntry {
  return {
    videoId: "dQw4w9WgXcQ",
    model: "claude-sonnet-4-6",
    sectionPref: "",
    generatedAt: "2024-01-01T00:00:00.000Z",
    summary: SUMMARY,
    ...overrides,
  };
}

describe("cacheKey", () => {
  it("formats key as summary:videoId:model:sectionPref", () => {
    expect(cacheKey("dQw4w9WgXcQ", "claude-sonnet-4-6", "")).toBe(
      "summary:dQw4w9WgXcQ:claude-sonnet-4-6:",
    );
  });

  it("includes non-empty sectionPref in key", () => {
    expect(cacheKey("vid1", "claude-haiku-4-5-20251001", "3-sections")).toBe(
      "summary:vid1:claude-haiku-4-5-20251001:3-sections",
    );
  });
});

describe("getFromCache", () => {
  it("returns null when key is not in storage", async () => {
    const result = await getFromCache("vid1", "claude-sonnet-4-6", "", makeStorage());
    expect(result).toBeNull();
  });
});

describe("saveToCache + getFromCache", () => {
  it("round-trips a CacheEntry", async () => {
    const storage = makeStorage();
    const entry = makeEntry();
    await saveToCache(entry, storage);
    const result = await getFromCache(entry.videoId, entry.model, entry.sectionPref, storage);
    expect(result).toEqual(entry);
  });

  it("different model produces a cache miss", async () => {
    const storage = makeStorage();
    await saveToCache(makeEntry({ model: "claude-sonnet-4-6" }), storage);
    const result = await getFromCache("dQw4w9WgXcQ", "claude-opus-4-7", "", storage);
    expect(result).toBeNull();
  });

  it("different sectionPref produces a cache miss", async () => {
    const storage = makeStorage();
    await saveToCache(makeEntry({ sectionPref: "short" }), storage);
    const result = await getFromCache("dQw4w9WgXcQ", "claude-sonnet-4-6", "long", storage);
    expect(result).toBeNull();
  });

  it("saveToCache overwrites an existing entry", async () => {
    const storage = makeStorage();
    const first = makeEntry();
    const second = makeEntry({
      generatedAt: "2024-06-01T00:00:00.000Z",
      summary: { language: "hu", sections: [{ sec: 10, title: "Bevezető", summary: "Szia világ." }] },
    });
    await saveToCache(first, storage);
    await saveToCache(second, storage);
    const result = await getFromCache("dQw4w9WgXcQ", "claude-sonnet-4-6", "", storage);
    expect(result).toEqual(second);
  });
});
