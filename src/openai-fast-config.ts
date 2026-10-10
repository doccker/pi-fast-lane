/** OpenAI-specific Fast Mode options (`"openai"` section of pi-fast-lane.json). */
export interface OpenAIFastConfig {
  /**
   * Cost multiplier for Codex (`openai-codex-responses`) turns sent with Fast Mode.
   * Default 2.5 matches how ChatGPT plans consume included usage; set 2 for purchased credits, 1 to turn it off.
   */
  codexFastCostMultiplier: number;
}

export const DEFAULT_OPENAI_FAST_CONFIG: Readonly<OpenAIFastConfig> = {
  codexFastCostMultiplier: 2.5,
};

export function defaultOpenAIFastConfig(): OpenAIFastConfig {
  return { ...DEFAULT_OPENAI_FAST_CONFIG };
}

function isValidMultiplier(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 1;
}

/** Overlays the known fields of a raw `openai` section; unknown or invalid fields keep the base value. */
export function mergeOpenAIFastConfig(base: OpenAIFastConfig, source: unknown): OpenAIFastConfig {
  const next = { ...base };
  if (typeof source !== "object" || source === null || Array.isArray(source)) {
    return next;
  }

  const record = source as Record<string, unknown>;
  if (isValidMultiplier(record.codexFastCostMultiplier)) {
    next.codexFastCostMultiplier = record.codexFastCostMultiplier;
  }
  return next;
}
