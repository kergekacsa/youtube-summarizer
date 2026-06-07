import type { Summary } from "./summarize";

export interface CacheEntry {
  videoId: string;
  model: string;
  /** Reserved for future section-count/language preferences. Pass "" for now. */
  sectionPref: string;
  generatedAt: string;
  summary: Summary;
}

export interface CacheStorageLike {
  get(keys: string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export function cacheKey(videoId: string, model: string, sectionPref: string): string {
  return `summary:${videoId}:${model}:${sectionPref}`;
}

export async function getFromCache(
  videoId: string,
  model: string,
  sectionPref: string,
  storage: CacheStorageLike,
): Promise<CacheEntry | null> {
  const key = cacheKey(videoId, model, sectionPref);
  const stored = await storage.get([key]);
  const raw = stored[key];
  if (!raw || typeof raw !== "object") return null;
  return raw as CacheEntry;
}

export async function saveToCache(entry: CacheEntry, storage: CacheStorageLike): Promise<void> {
  const key = cacheKey(entry.videoId, entry.model, entry.sectionPref);
  await storage.set({ [key]: entry });
}
