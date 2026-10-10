import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import {
  ANTHROPIC_FAST_FALLBACK_NOTICE,
  ANTHROPIC_FAST_RATE_LIMITED_NOTICE,
  ANTHROPIC_FAST_REJECTED_NOTICE,
  ANTHROPIC_FAST_REJECTED_SUBSCRIPTION_NOTICE,
  ANTHROPIC_FAST_SUBSCRIPTION_NOTICE,
  classifyAnthropicFastError,
} from "../src/anthropic-fast-notices.ts";
import { FAST_DESIRED_HANDOFF_ENV } from "../src/fast-desired-handoff.ts";
import { registerPiFastLane } from "../src/extension-lifecycle.ts";

const OPUS = { provider: "anthropic", id: "claude-opus-5-5", api: "anthropic-messages" };
const REJECTED =
  '400 {"type":"error","error":{"type":"invalid_request_error","message":"Fast mode requires usage credits"}}';
// Real response observed 2026-10-10 on a Claude subscription login without usage credits.
const CREDITS_REQUIRED_429 =
  '429 {"type":"error","error":{"type":"rate_limit_error","message":"Usage credits are required for fast mode."},"request_id":"req_x"}';
const RATE_LIMITED = '429 {"type":"error","error":{"type":"rate_limit_error","message":"Rate limited"}}';
const UNRELATED = '400 {"type":"error","error":{"type":"invalid_request_error","message":"prompt is too long"}}';

function createHarness(anthropic = { fallbackOnReject: false }) {
  const commands = new Map();
  const handlers = new Map();
  const config = {
    persistState: false,
    desiredActive: false,
    supportedModels: ["anthropic/claude-opus-5-5"],
    footer: { mode: "off", vars: {} },
    anthropic,
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

function createContext({ oauth }) {
  const notifications = [];
  return {
    notifications,
    ctx: {
      cwd: "/work/repo",
      hasUI: true,
      model: OPUS,
      sessionManager: { getCwd: () => "/work/repo", getSessionName: () => undefined, getEntries: () => [] },
      modelRegistry: { isUsingOAuth: () => oauth },
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

async function startWithFast(harness, ctx) {
  await emit(harness, "session_start", { type: "session_start" }, ctx);
  await harness.commands.get("fast").handler("", ctx);
}

function sendRequest(harness, ctx) {
  return emit(harness, "before_provider_request", { type: "before_provider_request", payload: { model: OPUS.id } }, ctx);
}

function failWith(harness, ctx, errorMessage) {
  const message = { role: "assistant", api: "anthropic-messages", stopReason: "error", errorMessage };
  return emit(harness, "message_end", { type: "message_end", message }, ctx);
}

const has = (notifications, message) => notifications.some((notice) => notice.message === message);

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

test("classifies fast rejections and rate limits, ignores unrelated errors", () => {
  assert.equal(classifyAnthropicFastError(REJECTED), "rejected");
  assert.equal(classifyAnthropicFastError(CREDITS_REQUIRED_429), "rejected");
  assert.equal(classifyAnthropicFastError(RATE_LIMITED), "rate-limited");
  assert.equal(classifyAnthropicFastError(UNRELATED), undefined);
  assert.equal(classifyAnthropicFastError("500 internal fast error"), undefined);
  assert.equal(classifyAnthropicFastError(undefined), undefined);
});

test("/fast on a subscription login adds the usage credits notice", async () => {
  const harness = createHarness();
  const { ctx, notifications } = createContext({ oauth: true });
  await startWithFast(harness, ctx);
  assert.ok(has(notifications, ANTHROPIC_FAST_SUBSCRIPTION_NOTICE));
});

test("/fast with an API key does not show the usage credits notice", async () => {
  const harness = createHarness();
  const { ctx, notifications } = createContext({ oauth: false });
  await startWithFast(harness, ctx);
  assert.ok(!has(notifications, ANTHROPIC_FAST_SUBSCRIPTION_NOTICE));
});

test("a rejected fast request on a subscription shows the credits hint and keeps fast on by default", async () => {
  const harness = createHarness();
  const { ctx, notifications } = createContext({ oauth: true });
  await startWithFast(harness, ctx);
  await sendRequest(harness, ctx);
  await failWith(harness, ctx, REJECTED);

  assert.ok(has(notifications, ANTHROPIC_FAST_REJECTED_SUBSCRIPTION_NOTICE));
  assert.ok(!has(notifications, ANTHROPIC_FAST_FALLBACK_NOTICE));
  const [payload] = await sendRequest(harness, ctx);
  assert.equal(payload.speed, "fast");
});

test("fallbackOnReject turns fast off for the session after a rejection", async () => {
  const harness = createHarness({ fallbackOnReject: true });
  const { ctx, notifications } = createContext({ oauth: false });
  await startWithFast(harness, ctx);
  await sendRequest(harness, ctx);
  await failWith(harness, ctx, REJECTED);

  assert.ok(has(notifications, ANTHROPIC_FAST_REJECTED_NOTICE));
  assert.ok(has(notifications, ANTHROPIC_FAST_FALLBACK_NOTICE));
  assert.equal(process.env[FAST_DESIRED_HANDOFF_ENV], "0");
  const [payload] = await sendRequest(harness, ctx);
  assert.equal(payload, undefined);
});

test("a 429 saying usage credits are required counts as a rejection and falls back", async () => {
  const harness = createHarness({ fallbackOnReject: true });
  const { ctx, notifications } = createContext({ oauth: true });
  await startWithFast(harness, ctx);
  await sendRequest(harness, ctx);
  await failWith(harness, ctx, CREDITS_REQUIRED_429);

  assert.ok(has(notifications, ANTHROPIC_FAST_REJECTED_SUBSCRIPTION_NOTICE));
  assert.ok(!has(notifications, ANTHROPIC_FAST_RATE_LIMITED_NOTICE));
  assert.ok(has(notifications, ANTHROPIC_FAST_FALLBACK_NOTICE));
  const [retryPayload] = await sendRequest(harness, ctx);
  assert.equal(retryPayload, undefined);
});

test("rate limits only warn, even with fallbackOnReject", async () => {
  const harness = createHarness({ fallbackOnReject: true });
  const { ctx, notifications } = createContext({ oauth: true });
  await startWithFast(harness, ctx);
  await sendRequest(harness, ctx);
  await failWith(harness, ctx, RATE_LIMITED);

  assert.ok(has(notifications, ANTHROPIC_FAST_RATE_LIMITED_NOTICE));
  const [payload] = await sendRequest(harness, ctx);
  assert.equal(payload.speed, "fast");
});

test("errors from requests sent without fast mode are left alone", async () => {
  const harness = createHarness({ fallbackOnReject: true });
  const { ctx, notifications } = createContext({ oauth: true });
  await emit(harness, "session_start", { type: "session_start" }, ctx);
  await sendRequest(harness, ctx);
  await failWith(harness, ctx, REJECTED);

  assert.ok(!has(notifications, ANTHROPIC_FAST_REJECTED_SUBSCRIPTION_NOTICE));
});
