/**
 * User-facing notices for Anthropic fast mode, including Claude subscription (OAuth) logins.
 *
 * Error classification is a heuristic over Pi's `errorMessage` text: Anthropic's exact rejection wording
 * for fast mode is not documented, so a rejection only counts when the request carried fast mode and the
 * error is a 4xx that mentions fast/speed/credits. Anything else stays a normal error.
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
  "Fast Mode turned off for this session after the rejection. Send your message again to retry at standard speed; run /fast to turn it back on.";

export type AnthropicFastErrorKind = "rate-limited" | "rejected";

const RATE_LIMIT_PATTERN = /\b429\b|rate_limit_error/i;
const CLIENT_ERROR_PATTERN =
  /^\s*(?:\S+\s+\()?(?:400|402|403)\b|"type"\s*:\s*"(?:invalid_request_error|permission_error|billing_error)"/i;
const FAST_TOPIC_PATTERN = /\bfast\b|\bspeed\b|fast-mode|usage credits|extra usage/i;

/** Classifies an assistant error from a request that was sent with Anthropic fast mode. */
export function classifyAnthropicFastError(errorMessage: unknown): AnthropicFastErrorKind | undefined {
  if (typeof errorMessage !== "string" || errorMessage.length === 0) {
    return undefined;
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
