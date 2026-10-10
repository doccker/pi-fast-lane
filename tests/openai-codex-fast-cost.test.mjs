import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { FAST_DESIRED_HANDOFF_ENV } from "../src/fast-desired-handoff.ts";
import { registerPiFastLane } from "../src/extension-lifecycle.ts";
import { OpenAICodexFastCostTracker } from "../src/openai-codex-fast-cost.ts";

const API = "openai-codex-responses";
const CODEX = { provider: "openai-codex", id: "gpt-6.1-sol", api: API };

function assistant(overrides = {}) {
  return {
    role: "assistant",
    api: API,
    stopReason: "stop",
    usage: { cost: { input: 1, output: 2, cacheRead: 0.5, cacheWrite: 0, total: 3.5 } },
    ...overrides,
  };
}

function completed(serviceTier) {
  return { api: API, data: { type: "response.completed", response: { service_tier: serviceTier } } };
}

test("reprices a Codex fast turn even though the backend reports default", () => {
  const tracker = new OpenAICodexFastCostTracker();
  tracker.markRequest(true);
  tracker.observeStreamEvent(completed("default"));
  const adjusted = tracker.adjustMessage(assistant(), 2.5);
  assert.deepEqual(adjusted.usage.cost, { input: 2.5, output: 5, cacheRead: 1.25, cacheWrite: 0, total: 8.75 });
});

test("leaves standard turns, priority-priced responses, errors and multiplier 1 alone", () => {
  const tracker = new OpenAICodexFastCostTracker();

  tracker.markRequest(false);
  assert.equal(tracker.adjustMessage(assistant(), 2.5), undefined);

  tracker.markRequest(true);
  tracker.observeStreamEvent(completed("priority"));
  assert.equal(tracker.adjustMessage(assistant(), 2.5), undefined);

  tracker.markRequest(true);
  assert.equal(tracker.adjustMessage(assistant({ stopReason: "error" }), 2.5), undefined);

  tracker.markRequest(true);
  assert.equal(tracker.adjustMessage(assistant(), 1), undefined);
});

test("the fast mark is consumed by one Codex message and ignores other APIs", () => {
  const tracker = new OpenAICodexFastCostTracker();
  tracker.markRequest(true);
  assert.equal(tracker.adjustMessage(assistant({ api: "anthropic-messages" }), 2.5), undefined);
  assert.ok(tracker.adjustMessage(assistant(), 2.5));
  assert.equal(tracker.adjustMessage(assistant(), 2.5), undefined);
});

function createHarness(openai) {
  const commands = new Map();
  const handlers = new Map();
  const config = {
    persistState: false,
    desiredActive: false,
    supportedModels: ["openai-codex/gpt-6.1-sol"],
    footer: { mode: "off", vars: {} },
    ...(openai === undefined ? {} : { openai }),
  };
  const pi = {
    registerCommand: (name, options) => commands.set(name, options),
    registerFlag: () => {},
    getFlag: () => undefined,
    getThinkingLevel: () => "off",
    on(event, handler) {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
    },
  };
  registerPiFastLane(pi, { configStore: { load: async () => config, writeDesiredActive: async () => true } });
  return { commands, handlers };
}

const ctx = {
  cwd: "/work/repo",
  hasUI: true,
  model: CODEX,
  sessionManager: { getCwd: () => "/work/repo", getSessionName: () => undefined, getEntries: () => [] },
  modelRegistry: { isUsingOAuth: () => true },
  getContextUsage: () => ({ percent: 1, contextWindow: 272_000 }),
  ui: { notify: () => {}, setStatus: () => {} },
};

async function emit(harness, name, event) {
  const results = [];
  for (const handler of harness.handlers.get(name) ?? []) {
    results.push(await handler(event, ctx));
  }
  return results;
}

async function runTurn(harness) {
  await emit(harness, "before_provider_request", { type: "before_provider_request", payload: { model: CODEX.id } });
  await emit(harness, "provider_stream_event", { type: "provider_stream_event", ...completed("default") });
  const [result] = await emit(harness, "message_end", { type: "message_end", message: assistant() });
  return result;
}

let inheritedHandoff;
beforeEach(() => {
  inheritedHandoff = process.env[FAST_DESIRED_HANDOFF_ENV];
  delete process.env[FAST_DESIRED_HANDOFF_ENV];
});
afterEach(() => {
  if (inheritedHandoff === undefined) {
    delete process.env[FAST_DESIRED_HANDOFF_ENV];
  } else {
    process.env[FAST_DESIRED_HANDOFF_ENV] = inheritedHandoff;
  }
});

test("lifecycle reprices Codex fast turns with the default 2.5x and leaves standard turns alone", async () => {
  const harness = createHarness();
  await emit(harness, "session_start", { type: "session_start" });

  assert.equal(await runTurn(harness), undefined);

  await harness.commands.get("fast").handler("", ctx);
  const fast = await runTurn(harness);
  assert.equal(fast.message.usage.cost.total, 8.75);
});

test("lifecycle honors a configured codexFastCostMultiplier", async () => {
  const harness = createHarness({ codexFastCostMultiplier: 2 });
  await emit(harness, "session_start", { type: "session_start" });
  await harness.commands.get("fast").handler("", ctx);
  const fast = await runTurn(harness);
  assert.equal(fast.message.usage.cost.total, 7);
});
