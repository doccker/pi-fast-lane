# Changelog

## Unreleased

- Default `supportedModels` updated for the current OpenAI line-up: `gpt-6.1-sol`, `gpt-6-astra`, `gpt-6-luna`, `gpt-5.6-sol` (API) and the same plus `gpt-6-sol` (Codex). `gpt-5.4` / `gpt-5.5` are dropped (GPT-5.5 retires from Codex on 2026-10-14). The first run writes the defaults into `~/.pi/agent/extensions/pi-fast-lane.json`, so existing installs keep their old list; edit `supportedModels` there (or delete the file to regenerate it).
- README: OpenAI notes (request field, default models, plan and credit multipliers).

## 0.2.1

- Fix: Anthropic reports missing usage credits for fast mode as `429 rate_limit_error` ("Usage credits are required for fast mode."). It is now treated as a rejection, so `anthropic.fallbackOnReject` turns fast off and Pi's automatic retry runs at standard speed, instead of retrying the same fast request until retries run out.

## 0.2.0

- Claude subscription (OAuth) logins: turning on `/fast` reminds you that fast requests are billed to usage credits.
- Clear hints when Anthropic rejects a fast request or fast mode hits its rate limit, instead of only the raw error.
- New option `anthropic.fallbackOnReject` (default `false`): turn Fast Mode off for the rest of the session after a rejection.
- Published to npm: `pi install npm:pi-fast-lane`.

## 0.1.0

- Fork of `studioarray/pi-openai-fast`: one `/fast` toggle for OpenAI priority service tier and Anthropic Claude fast mode (`speed: "fast"` + `fast-mode-2026-02-01` beta), with fast-rate cost display.
