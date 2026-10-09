import assert from "node:assert/strict";
import { test } from "node:test";
import { AnthropicFastCostTracker } from "../src/anthropic-fast-cost.ts";

const API = "anthropic-messages";

function assistant(overrides = {}) {
  return {
    role: "assistant",
    api: API,
    provider: "anthropic",
    model: "claude-opus-5-5",
    content: [],
    usage: {
      input: 1000,
      output: 500,
      cacheRead: 2000,
      cacheWrite: 0,
      totalTokens: 3500,
      cost: { input: 0.004, output: 0.01, cacheRead: 0.0004, cacheWrite: 0, total: 0.0144 },
    },
    ...overrides,
  };
}

function start(speed) {
  return { api: API, data: { type: "message_start", message: { usage: speed === undefined ? {} : { speed } } } };
}

test("doubles every cost component when Anthropic reports fast speed", () => {
  const tracker = new AnthropicFastCostTracker();
  tracker.observeStreamEvent(start("fast"));
  const original = assistant();

  const adjusted = tracker.adjustMessage(original);

  assert.equal(adjusted.usage.cost.input, 0.008);
  assert.equal(adjusted.usage.cost.output, 0.02);
  assert.equal(adjusted.usage.cost.cacheRead, 0.0008);
  assert.equal(adjusted.usage.cost.cacheWrite, 0);
  assert.ok(Math.abs(adjusted.usage.cost.total - 0.0288) < 1e-12);
  assert.equal(adjusted.usage.totalTokens, 3500);
  assert.equal(original.usage.cost.input, 0.004);
});

test("reads the speed from message_delta when message_start omitted it", () => {
  const tracker = new AnthropicFastCostTracker();
  tracker.observeStreamEvent(start(undefined));
  tracker.observeStreamEvent({ api: API, data: { type: "message_delta", usage: { output_tokens: 5, speed: "fast" } } });

  assert.ok(tracker.adjustMessage(assistant()));
});

test("keeps standard pricing when the server ran the request at standard speed", () => {
  const tracker = new AnthropicFastCostTracker();
  tracker.observeStreamEvent(start("standard"));

  assert.equal(tracker.adjustMessage(assistant()), undefined);
});

test("does not leak a fast observation into the next response", () => {
  const tracker = new AnthropicFastCostTracker();
  tracker.observeStreamEvent(start("fast"));
  assert.ok(tracker.adjustMessage(assistant()));

  assert.equal(tracker.adjustMessage(assistant()), undefined);

  tracker.observeStreamEvent(start("fast"));
  tracker.observeStreamEvent(start(undefined));
  assert.equal(tracker.adjustMessage(assistant()), undefined);
});

test("ignores non-Anthropic events and messages", () => {
  const tracker = new AnthropicFastCostTracker();
  tracker.observeStreamEvent({ api: "openai-responses", data: { type: "message_start", message: { usage: { speed: "fast" } } } });
  assert.equal(tracker.adjustMessage(assistant()), undefined);

  tracker.observeStreamEvent(start("fast"));
  assert.equal(tracker.adjustMessage({ role: "user", content: "hi" }), undefined);
  assert.equal(tracker.adjustMessage(assistant({ api: "openai-responses" })), undefined);
  assert.equal(tracker.adjustMessage(assistant({ usage: { cost: null } })), undefined);
});
