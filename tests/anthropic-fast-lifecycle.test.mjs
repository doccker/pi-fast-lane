import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { FAST_DESIRED_HANDOFF_ENV } from "../src/fast-desired-handoff.ts";
import { ANTHROPIC_FAST_CACHE_NOTICE, registerPiFastLane } from "../src/extension-lifecycle.ts";

const OPUS = { provider: "anthropic", id: "claude-opus-5-5", api: "anthropic-messages" };
const OPUS_47 = { provider: "anthropic", id: "claude-opus-4-7", api: "anthropic-messages" };

function createHarness() {
  const commands = new Map();
  const handlers = new Map();
  const config = {
    persistState: false,
    desiredActive: false,
    supportedModels: ["anthropic/claude-opus-5-5"],
    footer: { mode: "off", vars: {} },
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
  const configStore = { load: async () => config, writeDesiredActive: async () => true };
  registerPiFastLane(pi, { configStore });
  return { commands, handlers };
}

function createContext(model) {
  const notifications = [];
  return {
    notifications,
    ctx: {
      cwd: "/work/repo",
      hasUI: true,
      model,
      sessionManager: { getCwd: () => "/work/repo", getSessionName: () => undefined, getEntries: () => [] },
      modelRegistry: { isUsingOAuth: () => true },
      getContextUsage: () => ({ percent: 1, contextWindow: 1_000_000 }),
      ui: { notify: (message, type) => notifications.push({ message, type }), setStatus: () => {} },
    },
  };
}

async function emit(harness, name, event, ctx) {
  const results = [];
  for (const handler of harness.handlers.get(name) ?? []) {
    results.push(await handler(event, ctx));
  }
  return results;
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

test("/fast on a supported Anthropic model injects speed + beta and warns about the cache", async () => {
  const harness = createHarness();
  const { ctx, notifications } = createContext(OPUS);
  await emit(harness, "session_start", { type: "session_start" }, ctx);
  await harness.commands.get("fast").handler("", ctx);

  const [payload] = await emit(
    harness,
    "before_provider_request",
    { type: "before_provider_request", payload: { model: "claude-opus-5-5", betas: ["oauth-2025-04-20"] } },
    ctx,
  );

  assert.deepEqual(payload, {
    model: "claude-opus-5-5",
    betas: ["oauth-2025-04-20", "fast-mode-2026-02-01"],
    speed: "fast",
  });
  assert.ok(notifications.some(({ message }) => message === ANTHROPIC_FAST_CACHE_NOTICE));
});

test("switching to an unsupported Anthropic model stops injecting fast mode", async () => {
  const harness = createHarness();
  const { ctx } = createContext(OPUS);
  await emit(harness, "session_start", { type: "session_start" }, ctx);
  await harness.commands.get("fast").handler("", ctx);

  const { ctx: ctx47 } = createContext(OPUS_47);
  await emit(harness, "model_select", { type: "model_select", model: OPUS_47 }, ctx47);
  const [payload] = await emit(
    harness,
    "before_provider_request",
    { type: "before_provider_request", payload: { model: "claude-opus-4-7" } },
    ctx47,
  );

  assert.equal(payload, undefined);
});

test("reprices the assistant message only when the stream reported fast speed", async () => {
  const harness = createHarness();
  const { ctx } = createContext(OPUS);
  const message = {
    role: "assistant",
    api: "anthropic-messages",
    usage: { cost: { input: 1, output: 2, cacheRead: 0.5, cacheWrite: 0, total: 3.5 } },
  };

  await emit(
    harness,
    "provider_stream_event",
    { type: "provider_stream_event", api: "anthropic-messages", data: { type: "message_start", message: { usage: { speed: "fast" } } } },
    ctx,
  );
  const [fastResult] = await emit(harness, "message_end", { type: "message_end", message }, ctx);
  assert.equal(fastResult.message.usage.cost.total, 7);

  const [standardResult] = await emit(harness, "message_end", { type: "message_end", message }, ctx);
  assert.equal(standardResult, undefined);
});
