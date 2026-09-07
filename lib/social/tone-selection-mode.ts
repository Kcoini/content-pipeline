// Phase 3-21: "문체 설정" UI의 라디오 3종과 1:1로 대응하는 값 검증.
import type { ToneSelectionMode } from "./multi-platform-generation-service";

const TONE_SELECTION_MODES: readonly ToneSelectionMode[] = ["auto_recommended", "same_for_all", "manual_per_platform"];

export function isToneSelectionMode(value: unknown): value is ToneSelectionMode {
  return typeof value === "string" && (TONE_SELECTION_MODES as readonly string[]).includes(value);
}
