import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { DEFAULT_FAST_CONFIG, DEFAULT_SUPPORTED_MODELS } from "../src/fast-config-store.ts";

const README_URL = new URL("../README.md", import.meta.url);

async function readReadmeConfigExample() {
  const readme = await readFile(README_URL, "utf8");
  const blocks = [...readme.matchAll(/```json\r?\n([\s\S]*?)```/g)].map((match) => match[1]);
  const block = blocks.find((body) => body.includes('"supportedModels"'));
  assert.ok(block, 'README.md has no ```json block containing "supportedModels"');

  try {
    return JSON.parse(block);
  } catch (error) {
    assert.fail(`README.md config example is not valid JSON: ${error.message}\n${block}`);
  }
}

test("README config example matches the code defaults", async () => {
  const example = await readReadmeConfigExample();

  assert.deepEqual(
    example.supportedModels,
    [...DEFAULT_SUPPORTED_MODELS],
    "README supportedModels must equal DEFAULT_SUPPORTED_MODELS (same order)",
  );
  assert.equal(example.persistState, DEFAULT_FAST_CONFIG.persistState, "README persistState");
  assert.equal(example.desiredActive, DEFAULT_FAST_CONFIG.desiredActive, "README desiredActive");
  assert.equal(example.footer?.mode, DEFAULT_FAST_CONFIG.footer.mode, "README footer.mode");
  assert.deepEqual(example.anthropic, DEFAULT_FAST_CONFIG.anthropic, "README anthropic section");
  assert.deepEqual(example.openai, DEFAULT_FAST_CONFIG.openai, "README openai section");
});
