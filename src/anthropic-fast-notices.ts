/**
 * User-facing notices for Anthropic fast mode, including Claude subscription (OAuth) logins.
 *
 * Error classification is a heuristic over Pi's `errorMessage` text (only for requests that carried fast mode):
 * - Missing usage credits is a rejection whatever the status. Observed 2026-10-10 on a subscription login:
 *   `429 {"type":"error","error":{"type":"rate_limit_error","message":"Usage credits are required for fast mode."}}`
 *   Treating it as a rate limit would let Pi retry the same fast request until the retries run out.
 * - Other 429s are rate limits; other 4xx count as rejections only when they mention fast/speed/credits.
 */
export const ANTHROPIC_FAST_CACHE_NOTICE =
  "Anthropic fast mode on: speed changes invalidate the prompt cache, so the next request bills the full context at fast rates.";

export const ANTHROPIC_FAST_SUBSCRIPTION_NOTICE =
  "Claude subscription login: fast mode is billed to usage credits at fast API rates, not to your plan limits. Turn on usage credits in Claude settings first.";

export const ANTHROPIC_FAST_RATE_LIMITED_NOTICE =
  "Anthropic fast mode hit its rate limit. Run /fast to switch back to standard speed, or retry later.";

export const ANTHROPIC_FAST_REJECTED_NOTICE =
  "Anthropic rejected the fast mode request. Check that the model supports fast mode and that you use the first-party Anthropic API.";

export const ANTHROPIC_FAST_REJECTED_SUBSCRIPTION_NOTICE =
  "Anthropic rejected the fast mode request. With a Claude subscription login, fast mode needs usage credits turned on in Claude settings.";

export const ANTHROPIC_FAST_FALLBACK_NOTICE =
  "Fast Mode turned off for this session after the rejection. The next attempt uses standard speed (send your message again if Pi does not retry it); run /fast to turn it back on.";

export type AnthropicFastErrorKind = "rate-limited" | "rejected";

const CREDITS_REQUIRED_PATTERN = /usage credits (?:are |is )?required|requires? usage credits|extra usage (?:is )?required/i;
const RATE_LIMIT_PATTERN = /\b429\b|rate_limit_error/i;
const CLIENT_ERROR_PATTERN =
  /^\s*(?:\S+\s+\()?(?:400|402|403)\b|"type"\s*:\s*"(?:invalid_request_error|permission_error|billing_error)"/i;
const FAST_TOPIC_PATTERN = /\bfast\b|\bspeed\b|fast-mode|usage credits|extra usage/i;

/** Classifies an assistant error from a request that was sent with Anthropic fast mode. */
export function classifyAnthropicFastError(errorMessage: unknown): AnthropicFastErrorKind | undefined {
  if (typeof errorMessage !== "string" || errorMessage.length === 0) {
    return undefined;
  }

  if (CREDITS_REQUIRED_PATTERN.test(errorMessage)) {
    return "rejected";
  }

  if (RATE_LIMIT_PATTERN.test(errorMessage)) {
    return "rate-limited";
  }

  if (CLIENT_ERROR_PATTERN.test(errorMessage) && FAST_TOPIC_PATTERN.test(errorMessage)) {
    return "rejected";
  }

  return undefined;
}

export function anthropicFastErrorNotice(kind: AnthropicFastErrorKind, usingSubscription: boolean): string {
  if (kind === "rate-limited") {
    return ANTHROPIC_FAST_RATE_LIMITED_NOTICE;
  }

  return usingSubscription ? ANTHROPIC_FAST_REJECTED_SUBSCRIPTION_NOTICE : ANTHROPIC_FAST_REJECTED_NOTICE;
}
