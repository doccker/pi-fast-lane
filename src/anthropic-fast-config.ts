/** Anthropic-specific Fast Mode options (`"anthropic"` section of pi-fast-lane.json). */
export interface AnthropicFastConfig {
  /** Turn Fast Mode off for the rest of the session when Anthropic rejects a fast request. */
  fallbackOnReject: boolean;
}

export const DEFAULT_ANTHROPIC_FAST_CONFIG: Readonly<AnthropicFastConfig> = {
  fallbackOnReject: false,
};

export function defaultAnthropicFastConfig(): AnthropicFastConfig {
  return { ...DEFAULT_ANTHROPIC_FAST_CONFIG };
}

/** Overlays the known fields of a raw `anthropic` section; unknown or mistyped fields keep the base value. */
export function mergeAnthropicFastConfig(base: AnthropicFastConfig, source: unknown): AnthropicFastConfig {
  const next = { ...base };
  if (typeof source !== "object" || source === null || Array.isArray(source)) {
    return next;
  }

  const record = source as Record<string, unknown>;
  if (typeof record.fallbackOnReject === "boolean") {
    next.fallbackOnReject = record.fallbackOnReject;
  }
  return next;
}
