export const PRIORITY_SERVICE_TIER = "priority";
export const ANTHROPIC_MESSAGES_API = "anthropic-messages";
export const ANTHROPIC_FAST_SPEED = "fast";
export const ANTHROPIC_FAST_MODE_BETA = "fast-mode-2026-02-01";

export interface FastActivationState {
  active: boolean;
}

/** Minimal view of the Pi model that is about to receive the request. */
export interface FastRequestModel {
  api?: unknown;
  id?: unknown;
}

export type ProviderPayload = Record<string, unknown>;

function isRecordPayload(payload: unknown): payload is ProviderPayload {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(payload);
  return prototype === Object.prototype || prototype === null;
}

function injectAnthropicFast(payload: ProviderPayload, model: FastRequestModel): ProviderPayload {
  // Requests built for another model (for example a cheaper helper model) must not inherit fast mode:
  // unsupported Anthropic models reject `speed: "fast"` instead of falling back.
  if (typeof payload.model === "string" && typeof model.id === "string" && payload.model !== model.id) {
    return payload;
  }

  const existingBetas: unknown[] = Array.isArray(payload.betas) ? payload.betas : [];
  const betas = existingBetas.includes(ANTHROPIC_FAST_MODE_BETA)
    ? existingBetas
    : [...existingBetas, ANTHROPIC_FAST_MODE_BETA];

  return { ...payload, speed: ANTHROPIC_FAST_SPEED, betas };
}

/**
 * Adds the provider-specific Fast Mode request fields.
 *
 * Anthropic Messages requests get `speed: "fast"` plus the fast-mode beta appended to the
 * existing `betas` list (Pi's SDK client turns it into the `anthropic-beta` header).
 * Every other API keeps the original behavior and gets `service_tier: "priority"`.
 */
export class FastRequestInjector {
  inject(payload: unknown, state: FastActivationState, model?: FastRequestModel): unknown {
    if (!state.active || !isRecordPayload(payload)) {
      return payload;
    }

    if (model?.api === ANTHROPIC_MESSAGES_API) {
      return injectAnthropicFast(payload, model);
    }

    return { ...payload, service_tier: PRIORITY_SERVICE_TIER };
  }
}
