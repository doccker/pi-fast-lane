# pi-fast-lane

One `/fast` toggle for Pi that turns on the provider's fast mode for both **OpenAI** and **Anthropic Claude** models.

- **OpenAI** models (`openai`, `openai-codex`, …): adds `service_tier: "priority"` to the request.
- **Anthropic** models (`anthropic-messages` API): adds `speed: "fast"` and appends the `fast-mode-2026-02-01` beta. Pi's existing betas (OAuth, interleaved thinking, …) are kept.

The extension checks the current model's API and picks the right request fields automatically.

> Forked from [studioarray/pi-openai-fast](https://github.com/studioarray/pi-openai-fast) (MIT). The command, footer, config, and subagent handoff behavior come from upstream. This fork adds Anthropic support.

## Install

```bash
pi install npm:pi-fast-lane
```

Pin a version with `npm:pi-fast-lane@0.2.0`. The git source (`git:github.com/doccker/pi-fast-lane@vX.Y.Z`) still works.

Do not install it alongside `pi-openai-fast`, because both register `/fast` and `--fast`. Remove that package first.

## Use it

```text
/fast          # toggle Fast Mode for this session
pi --fast      # start a run with Fast Mode requested
```

Fast Mode is only sent when both of these are true:

1. You requested it with `/fast` or `--fast`.
2. The current model's `provider/model` key is in `supportedModels`.

If you switch to an unsupported model, your preference is kept but nothing is sent until you switch back to a supported model.

## OpenAI notes

Facts from the [Codex speed docs](https://developers.openai.com/codex/speed), [Codex pricing](https://developers.openai.com/codex/pricing), and the [API Fast mode guide](https://developers.openai.com/api/docs/guides/priority-processing) (checked 2026-10-10):

- **Request field:** `service_tier: "priority"`. The official Codex CLI sends the same value for its Fast mode, and the API accepts `priority` or `fast`.
- **Default models:** GPT-6.1 Sol, GPT-6 Sol (Codex), GPT-6 Astra, GPT-6 Luna, and GPT-5.6 Sol. GPT-5.5 retires from Codex on 2026-10-14, so it is no longer in the default list.
- **ChatGPT sign-in (`openai-codex`):** Fast mode uses included plan limits at 2.5x the Standard rate; purchased credits are billed at 2x.
- **API key (`openai`):** Fast mode is billed per token at a premium; see the API pricing page for current rates. This extension does not adjust `openai` costs.
- **Codex cost display:** the Codex backend reports `service_tier: "default"` even for Fast Mode requests (observed 2026-10-10: Fast Mode streamed about 1.45x faster on `gpt-6.1-sol` but still reported `default`), so Pi prices those turns at the standard rate. This extension multiplies the recorded cost of Codex turns it sent with Fast Mode by `openai.codexFastCostMultiplier`. If a response does report `priority`, Pi has already priced it and the cost is left as is.

## Anthropic notes (read before turning it on)

Facts from the [Anthropic fast mode docs](https://platform.claude.com/docs/en/build-with-claude/fast-mode) and the [Claude Code fast mode docs](https://code.claude.com/docs/en/fast-mode) (checked 2026-10-09):

- **Supported models:** Claude Opus 5.5, Opus 5, and Opus 4.8. Opus 4.7 **rejects** fast requests, so it is not in the default list.
- **Price:** 2x the standard rate on every token class. Opus 5.5 is $8/$40 per MTok; Opus 5 and 4.8 are $10/$50.
- **Subscription (OAuth) logins:** fast mode is billed to **usage credits only**, never to your plan limits. Turn on usage credits in Claude settings first.
- **Prompt cache:** switching speed invalidates the cache. The first fast request in a long session re-bills the whole context at fast rates. Turn it on at the start of a session when you can; `/fast` shows a reminder.
- **Speed:** up to 2.5x higher output tokens per second. Time to first token is not improved.
- **Availability:** first-party Anthropic API only. Not available on Bedrock, Vertex, or Foundry. Third-party relays may not forward it.
- **Rate limits:** fast mode has its own rate limits. Pi's normal 429 retry handling applies.

### Claude subscription (OAuth) logins

Works with Pi's built-in Claude subscription login (`/login` → Anthropic). Nothing extra is needed for the request: Pi already sends the Claude Code identity (user agent, `x-app`, the `claude-code` and `oauth` betas, and the Claude Code system line), and this extension only appends the fast-mode beta and `speed: "fast"`.

- When you turn on `/fast` on a subscription login, Pi shows a reminder that fast requests are billed to **usage credits**.
- If Anthropic rejects a fast request, you get a hint instead of only the raw error. On a subscription login the hint points to usage credits.
- If fast mode hits its own rate limit, you get a hint to run `/fast` and continue at standard speed. Fast mode stays on.
- Set `anthropic.fallbackOnReject` to `true` to turn Fast Mode off for the rest of the session after a rejection. The saved preference is not changed, so the next session tries fast again.
- Other extensions that edit Anthropic requests (for example a Claude Code billing-attribution extension) can run alongside this one; Pi passes the request through each extension in turn and this extension only touches `speed` and `betas`.

Without usage credits, Anthropic answers a fast request with `429 rate_limit_error` and the message `Usage credits are required for fast mode.` (observed 2026-10-10). This extension treats that as a rejection, not a rate limit, so with `fallbackOnReject` Pi's automatic retry goes out at standard speed. Other 4xx errors count as rejections only when they mention fast mode, speed, or usage credits; everything else is shown as usual.

### Cost display

Pi prices Anthropic responses at the standard rate. This extension reads the `usage.speed` value that Anthropic returns. When the server reports `"fast"`, it doubles that message's recorded cost, so the session cost matches your bill. If the server ran the request at standard speed, the cost stays at standard.

## Works with subagents

Turn on `/fast` in the parent session, then launch subagents. Subagents started after that inherit the preference through `PI_FAST_LANE_DESIRED=1`, as long as they use a supported model and have this extension installed. Each fast subagent is billed at fast rates.

## Configure it

- Global: `~/.pi/agent/extensions/pi-fast-lane.json`
- Project: `.pi/extensions/pi-fast-lane.json` (overrides the global file)

```json
{
  "persistState": false,
  "desiredActive": false,
  "supportedModels": [
    "openai/gpt-6.1-sol",
    "openai/gpt-6-astra",
    "openai/gpt-6-luna",
    "openai/gpt-5.6-sol",
    "openai-codex/gpt-6.1-sol",
    "openai-codex/gpt-6-sol",
    "openai-codex/gpt-6-astra",
    "openai-codex/gpt-6-luna",
    "openai-codex/gpt-5.6-sol",
    "anthropic/claude-opus-5-5",
    "anthropic/claude-opus-5",
    "anthropic/claude-opus-4-8"
  ],
  "footer": {
    "mode": "replace"
  },
  "anthropic": {
    "fallbackOnReject": false
  },
  "openai": {
    "codexFastCostMultiplier": 2.5
  }
}
```

- `persistState`: remember `/fast` between Pi runs.
- `desiredActive`: the saved on/off preference, used when `persistState` is `true`.
- `supportedModels`: exact `provider/model` keys that may use Fast Mode. Setting this replaces the default list, so include every model you want, OpenAI and Anthropic alike. A custom provider (for example an Anthropic-compatible relay) works only if the upstream honors `speed` and the beta.
- `openai.codexFastCostMultiplier`: cost multiplier for Codex (`openai-codex`) turns sent with Fast Mode (default `2.5`, the ChatGPT plan rate). Use `2` if you pay with purchased credits, `1` to turn the correction off. Must be a number of at least 1.
- `anthropic.fallbackOnReject`: turn Fast Mode off for the current session when Anthropic rejects a fast request (default `false`).
- `footer.mode`: `replace` shows `fast` next to the model name (default), `status` shows a plain status indicator, and `off` hides the indicator.

### Custom label color

```json
{
  "footer": {
    "mode": "replace",
    "darkFastColor": "#00ffaa",
    "lightFastColor": "#0066cc"
  }
}
```

Invalid or missing colors fall back to the theme-matched color.

## Troubleshooting

**I turned Fast Mode on but do not see `fast`.** Check that the current model is in `supportedModels` and that `footer.mode` is not `off`.

**Anthropic requests fail after turning it on.** Check that the model supports fast mode (not Opus 4.7), that usage credits are enabled for subscription logins, and that you are not routed through Bedrock, Vertex, or a relay. Run `/fast` to go back to standard speed, or set `anthropic.fallbackOnReject` to do it automatically.

**How do I know a Claude response really ran fast?** The cost of that turn is doubled only when Anthropic reported `usage.speed: "fast"`.

**My subagent is not using Fast Mode.** It must start after `/fast` is turned on. Ask it to print `PI_FAST_LANE_DESIRED`; `1` means the preference was inherited.

## Development

```bash
npm install
npm run check   # tsc + node --test
```

## Credits

- Upstream: [studioarray/pi-openai-fast](https://github.com/studioarray/pi-openai-fast)
- Upstream's own reference: [pi-better-openai](https://github.com/mattleong/pi-better-openai/)
