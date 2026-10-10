# Changelog

## Unreleased

- Claude subscription (OAuth) logins: turning on `/fast` reminds you that fast requests are billed to usage credits.
- Clear hints when Anthropic rejects a fast request or fast mode hits its rate limit, instead of only the raw error.
- New option `anthropic.fallbackOnReject` (default `false`): turn Fast Mode off for the rest of the session after a rejection.
- Published to npm: `pi install npm:pi-fast-lane`.

## 0.1.0

- Fork of `studioarray/pi-openai-fast`: one `/fast` toggle for OpenAI priority service tier and Anthropic Claude fast mode (`speed: "fast"` + `fast-mode-2026-02-01` beta), with fast-rate cost display.
