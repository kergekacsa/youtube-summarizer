import { describe, it, expect } from "vitest";
import { validateApiKey, canSummarize } from "./validate-api-key";

describe("validateApiKey", () => {
  it("returns ok:true when the API responds", async () => {
    const createAnthropic = (apiKey: string) => {
      expect(apiKey).toBe("sk-ant-valid");
      return {
        messages: {
          create: async () => ({ content: [] }),
        },
      };
    };

    const result = await validateApiKey("sk-ant-valid", { createAnthropic });

    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/valid/i);
  });

  it("returns ok:false with a friendly message on 401", async () => {
    const createAnthropic = () => ({
      messages: {
        create: async () => {
          throw Object.assign(new Error("authentication error"), { status: 401 });
        },
      },
    });

    const result = await validateApiKey("sk-ant-bad", { createAnthropic });

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/invalid api key/i);
    expect(result.message).not.toMatch(/401/);
  });

  it("returns ok:false with a generic message on other errors", async () => {
    const createAnthropic = () => ({
      messages: {
        create: async () => {
          throw new Error("Network error");
        },
      },
    });

    const result = await validateApiKey("sk-ant-whatever", { createAnthropic });

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/couldn.t reach/i);
  });
});

describe("canSummarize", () => {
  it("returns false when key is empty", () => {
    expect(canSummarize("", null)).toBe(false);
  });

  it("returns true when key present and not yet tested", () => {
    expect(canSummarize("sk-ant-x", null)).toBe(true);
  });

  it("returns true when key was tested successfully", () => {
    expect(canSummarize("sk-ant-x", { ok: true, message: "API key is valid." })).toBe(true);
  });

  it("returns false when key was tested and failed", () => {
    expect(canSummarize("sk-ant-x", { ok: false, message: "Invalid API key." })).toBe(false);
  });
});
