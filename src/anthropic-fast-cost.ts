import { ANTHROPIC_FAST_SPEED, ANTHROPIC_MESSAGES_API } from "./fast-request-injector.ts";

/**
 * Anthropic fast mode bills every token class at 2x the model's standard rate
 * (Opus 5.5: $8/$40 vs $4/$20; Opus 5 and 4.8: $10/$50 vs $5/$25; cache multipliers stack on top).
 * Pi prices Anthropic responses at the standard rate, so the footer would under-report fast spend.
 */
export const ANTHROPIC_FAST_COST_MULTIPLIER = 2;

export interface ProviderStreamObservation {
  api: unknown;
  data: unknown;
}

type UnknownRecord = Record<string, unknown>;

interface CostBreakdown {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  total: number;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readSpeed(usage: unknown): string | undefined {
  return isRecord(usage) && typeof usage.speed === "string" ? usage.speed : undefined;
}

function isCostBreakdown(value: unknown): value is CostBreakdown {
  return (
    isRecord(value) &&
    ["input", "output", "cacheRead", "cacheWrite", "total"].every((key) => typeof value[key] === "number")
  );
}

function multiplyCost(cost: CostBreakdown, multiplier: number): CostBreakdown {
  const input = cost.input * multiplier;
  const output = cost.output * multiplier;
  const cacheRead = cost.cacheRead * multiplier;
  const cacheWrite = cost.cacheWrite * multiplier;
  return { ...cost, input, output, cacheRead, cacheWrite, total: input + output + cacheRead + cacheWrite };
}

/**
 * Tracks the speed Anthropic reports in `usage.speed` for the current streamed response and
 * reprices the finalized assistant message when the response actually ran at fast speed.
 *
 * Pricing follows the server-reported speed, not the local toggle: a fast request that the
 * API served at standard speed stays at the standard price.
 */
export class AnthropicFastCostTracker {
  private observedSpeed: string | undefined;

  observeStreamEvent(event: ProviderStreamObservation): void {
    if (event.api !== ANTHROPIC_MESSAGES_API || !isRecord(event.data)) {
      return;
    }

    if (event.data.type === "message_start") {
      this.observedSpeed = isRecord(event.data.message) ? readSpeed(event.data.message.usage) : undefined;
      return;
    }

    if (event.data.type === "message_delta") {
      this.observedSpeed = readSpeed(event.data.usage) ?? this.observedSpeed;
    }
  }

  /** Returns a repriced copy for fast Anthropic assistant messages, otherwise `undefined`. */
  adjustMessage(message: unknown): UnknownRecord | undefined {
    if (!isRecord(message) || message.role !== "assistant" || message.api !== ANTHROPIC_MESSAGES_API) {
      return undefined;
    }

    const speed = this.observedSpeed;
    this.observedSpeed = undefined;

    if (speed !== ANTHROPIC_FAST_SPEED || !isRecord(message.usage) || !isCostBreakdown(message.usage.cost)) {
      return undefined;
    }

    return {
      ...message,
      usage: { ...message.usage, cost: multiplyCost(message.usage.cost, ANTHROPIC_FAST_COST_MULTIPLIER) },
    };
  }
}
