import { describe, expect, it } from "vitest";
import { isToneSelectionMode } from "./tone-selection-mode";

describe("isToneSelectionMode (Phase 3-21)", () => {
  it("3가지 유효한 모드를 인식한다", () => {
    expect(isToneSelectionMode("auto_recommended")).toBe(true);
    expect(isToneSelectionMode("same_for_all")).toBe(true);
    expect(isToneSelectionMode("manual_per_platform")).toBe(true);
  });

  it("유효하지 않은 값은 거부한다", () => {
    expect(isToneSelectionMode("invalid")).toBe(false);
    expect(isToneSelectionMode(null)).toBe(false);
    expect(isToneSelectionMode(undefined)).toBe(false);
    expect(isToneSelectionMode(123)).toBe(false);
  });
});
