import assert from "node:assert/strict";
import { test } from "node:test";
import { FastRequestInjector } from "../src/fast-request-injector.ts";

test("injects priority service tier into a copied record payload while active", () => {
  const injector = new FastRequestInjector();
  const original = { model: "gpt-5.5", messages: [{ role: "user", content: "hi" }] };

  const injected = injector.inject(original, { active: true });

  assert.deepEqual(injected, {
    model: "gpt-5.5",
    messages: original.messages,
    service_tier: "priority",
  });
  assert.notEqual(injected, original);
  assert.deepEqual(original, { model: "gpt-5.5", messages: [{ role: "user", content: "hi" }] });
});

test("overwrites existing service_tier and preserves other fields", () => {
  const injector = new FastRequestInjector();
  const original = { model: "gpt-5.5", service_tier: "default", temperature: 0.2 };

  assert.deepEqual(injector.inject(original, { active: true }), {
    model: "gpt-5.5",
    service_tier: "priority",
    temperature: 0.2,
  });
  assert.equal(original.service_tier, "default");
});

test("returns the original payload while inactive", () => {
  const injector = new FastRequestInjector();
  const original = { model: "gpt-5.5" };

  const result = injector.inject(original, { active: false });

  assert.equal(result, original);
  assert.deepEqual(original, { model: "gpt-5.5" });
});

test("ignores null, arrays, primitives, and non-record objects", () => {
  const injector = new FastRequestInjector();
  const values = [null, ["messages"], "payload", 7, true, new Date("2026-05-20T00:00:00Z")];

  for (const value of values) {
    assert.equal(injector.inject(value, { active: true }), value);
  }
});

const ANTHROPIC = { api: "anthropic-messages", id: "claude-opus-5-5" };

test("injects Anthropic fast speed and appends the fast-mode beta to existing betas", () => {
  const injector = new FastRequestInjector();
  const original = { model: "claude-opus-5-5", max_tokens: 1024, betas: ["oauth-2025-04-20"] };

  const injected = injector.inject(original, { active: true }, ANTHROPIC);

  assert.deepEqual(injected, {
    model: "claude-opus-5-5",
    max_tokens: 1024,
    betas: ["oauth-2025-04-20", "fast-mode-2026-02-01"],
    speed: "fast",
  });
  assert.equal(Object.hasOwn(injected, "service_tier"), false);
  assert.deepEqual(original.betas, ["oauth-2025-04-20"]);
});

test("creates the Anthropic betas list when absent and does not duplicate the fast-mode beta", () => {
  const injector = new FastRequestInjector();

  assert.deepEqual(injector.inject({ model: "claude-opus-5-5" }, { active: true }, ANTHROPIC), {
    model: "claude-opus-5-5",
    speed: "fast",
    betas: ["fast-mode-2026-02-01"],
  });
  assert.deepEqual(
    injector.inject({ model: "claude-opus-5-5", betas: ["fast-mode-2026-02-01"] }, { active: true }, ANTHROPIC).betas,
    ["fast-mode-2026-02-01"],
  );
});

test("leaves Anthropic requests for a different model untouched", () => {
  const injector = new FastRequestInjector();
  const original = { model: "claude-haiku-4-5", betas: [] };

  assert.equal(injector.inject(original, { active: true }, ANTHROPIC), original);
});

test("leaves Anthropic requests untouched while inactive", () => {
  const injector = new FastRequestInjector();
  const original = { model: "claude-opus-5-5" };

  assert.equal(injector.inject(original, { active: false }, ANTHROPIC), original);
});

test("keeps the OpenAI service tier for non-Anthropic APIs", () => {
  const injector = new FastRequestInjector();

  assert.deepEqual(
    injector.inject({ model: "gpt-6.1-sol" }, { active: true }, { api: "openai-codex-responses", id: "gpt-6.1-sol" }),
    { model: "gpt-6.1-sol", service_tier: "priority" },
  );
});
