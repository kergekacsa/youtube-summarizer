export interface Settings {
  apiKey: string;
  model: string;
}

export interface StorageLike {
  get(keys: string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: "",
  model: "claude-sonnet-4-6",
};

export const MODELS = [
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6" },
  { id: "claude-opus-4-7", label: "Opus 4.7" },
] as const;

const STORAGE_KEY = "settings";

export async function loadSettings(storage: StorageLike): Promise<Settings> {
  const stored = await storage.get([STORAGE_KEY]);
  const raw = stored[STORAGE_KEY] as Partial<Settings> | undefined;
  return {
    apiKey: typeof raw?.apiKey === "string" ? raw.apiKey : DEFAULT_SETTINGS.apiKey,
    model: typeof raw?.model === "string" ? raw.model : DEFAULT_SETTINGS.model,
  };
}

export async function saveSettings(settings: Settings, storage: StorageLike): Promise<void> {
  await storage.set({ [STORAGE_KEY]: settings });
}
