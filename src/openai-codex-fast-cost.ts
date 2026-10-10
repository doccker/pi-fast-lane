import { isCostBreakdown, isRecord, multiplyCost, type UnknownRecord } from "./anthropic-fast-cost.ts";

export const OPENAI_CODEX_RESPONSES_API = "openai-codex-responses";

/**
 * Reprices Codex turns that this extension sent with Fast Mode.
 *
 * The Codex backend reports `service_tier: "default"` even when it served the request at priority
 * (observed 2026-10-10: priority requests streamed ~1.45x faster yet reported "default"), and Pi only
 * prices tiers it requested itself. So the decision follows the request this extension modified,
 * not the response. When the response does report `priority`, Pi has already applied its own
 * multiplier and this tracker leaves the message alone to avoid double counting.
 */
export class OpenAICodexFastCostTracker {
  private sentFast = false;
  private responseTier: unknown;

  markRequest(sentFast: boolean): void {
    this.sentFast = sentFast;
    this.responseTier = undefined;
  }

  observeStreamEvent(event: { api: unknown; data: unknown }): void {
    if (event.api !== OPENAI_CODEX_RESPONSES_API || !isRecord(event.data)) {
      return;
    }

    const type = event.data.type;
    if ((type === "response.completed" || type === "response.done") && isRecord(event.data.response)) {
      this.responseTier = event.data.response.service_tier;
    }
  }

  /** Returns a repriced copy for Codex fast turns, otherwise `undefined`. */
  adjustMessage(message: unknown, multiplier: number): UnknownRecord | undefined {
    if (!isRecord(message) || message.role !== "assistant" || message.api !== OPENAI_CODEX_RESPONSES_API) {
      return undefined;
    }

    const sentFast = this.sentFast;
    const responseTier = this.responseTier;
    this.sentFast = false;
    this.responseTier = undefined;

    if (!sentFast || responseTier === "priority" || multiplier <= 1 || !Number.isFinite(multiplier)) {
      return undefined;
    }
    if (message.stopReason === "error" || !isRecord(message.usage) || !isCostBreakdown(message.usage.cost)) {
      return undefined;
    }

    return { ...message, usage: { ...message.usage, cost: multiplyCost(message.usage.cost, multiplier) } };
  }
}
