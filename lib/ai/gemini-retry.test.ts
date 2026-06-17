import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getGeminiModelCandidates } from "./gemini-retry.ts";

describe("getGeminiModelCandidates", () => {
  it("uses 3.x fallbacks and excludes legacy 2.x models", () => {
    const models = getGeminiModelCandidates("gemini-3.5-flash");

    assert.equal(models[0], "gemini-3.5-flash");
    assert.ok(models.includes("gemini-3.1-flash-lite"));
    assert.ok(models.includes("gemini-3.1-pro-preview"));
    assert.ok(models.includes("gemini-flash-lite-latest"));
    assert.ok(models.includes("gemini-pro-latest"));
    assert.ok(!models.includes("gemini-2.5-flash"));
    assert.ok(!models.includes("gemini-2.0-flash"));
  });
});
