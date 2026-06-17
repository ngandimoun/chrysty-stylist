import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  generateContentWithRetry,
  getGeminiModelCandidates,
} from "./gemini-retry.ts";

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

describe("generateContentWithRetry", () => {
  it("stops trying models when deadlineMs is already exhausted", async () => {
    const attempted: string[] = [];

    await assert.rejects(
      generateContentWithRetry(
        async (model) => {
          attempted.push(model);
          throw new Error("503 UNAVAILABLE");
        },
        "gemini-3.5-flash",
        {
          maxAttemptsPerModel: 1,
          maxModels: 5,
          deadlineMs: 0,
          baseDelayMs: 0,
        }
      )
    );

    assert.equal(attempted.length, 0);
  });

  it("limits models when maxModels is set", async () => {
    const attempted: string[] = [];

    await assert.rejects(
      generateContentWithRetry(
        async (model) => {
          attempted.push(model);
          throw new Error("503 UNAVAILABLE");
        },
        "gemini-3.5-flash",
        {
          maxAttemptsPerModel: 1,
          maxModels: 2,
          baseDelayMs: 0,
        }
      )
    );

    assert.equal(attempted.length, 2);
    assert.equal(attempted[0], "gemini-3.5-flash");
    assert.equal(attempted[1], "gemini-3.1-flash-lite");
  });
});
