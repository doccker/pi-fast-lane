import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerPiFastLane } from "./src/extension-lifecycle.ts";

export {
  FAST_COMMAND,
  FAST_EXTENSION_CAPABILITIES,
  FAST_FLAG,
  FAST_STATUS_KEY,
} from "./src/capabilities.ts";
export type { FastExtensionCapability } from "./src/capabilities.ts";
export { registerPiFastLane } from "./src/extension-lifecycle.ts";

export default function piFastLane(pi: ExtensionAPI): void {
  registerPiFastLane(pi);
}
