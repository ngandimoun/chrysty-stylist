import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderPollTimeoutMs } from "./use-outfit-render-poll.ts";

describe("renderPollTimeoutMs", () => {
  it("scales with look count", () => {
    assert.equal(renderPollTimeoutMs(1), 320_000);
    assert.equal(renderPollTimeoutMs(3), 540_000);
  });
});
