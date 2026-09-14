import { describe, expect, it } from "vitest";
import { computeToneFormFields } from "./platform-tone-selection-ui-state";

describe("computeToneFormFields", () => {
  it("auto_recommended 모드에서는 추가 필드를 만들지 않는다", () => {
    const result = computeToneFormFields({
      toneMode: "auto_recommended",
      uniformToneStyle: "story",
      perPlatformTone: { wordpress_blog: "explanatory" },
      checkedPlatforms: ["wordpress_blog"],
    });
    expect(result).toEqual({ toneMode: "auto_recommended", uniformToneStyle: null, perPlatformEntries: [] });
  });

  it("same_for_all 모드에서는 uniformToneStyle만 채운다", () => {
    const result = computeToneFormFields({
      toneMode: "same_for_all",
      uniformToneStyle: "warning",
      perPlatformTone: {},
      checkedPlatforms: ["wordpress_blog", "x"],
    });
    expect(result).toEqual({ toneMode: "same_for_all", uniformToneStyle: "warning", perPlatformEntries: [] });
  });

  it("manual_per_platform 모드에서는 체크된 플랫폼만 perPlatformEntries에 담는다", () => {
    const result = computeToneFormFields({
      toneMode: "manual_per_platform",
      uniformToneStyle: "",
      perPlatformTone: { wordpress_blog: "explanatory", naver_cafe: "story", x: "curiosity" },
      checkedPlatforms: ["wordpress_blog", "naver_cafe"],
    });
    expect(result.perPlatformEntries).toEqual([
      { platform: "wordpress_blog", toneStyle: "explanatory" },
      { platform: "naver_cafe", toneStyle: "story" },
    ]);
  });

  it("선택 해제된 플랫폼의 문체 값은(과거에 남아 있어도) 절대 제출하지 않는다", () => {
    const result = computeToneFormFields({
      toneMode: "manual_per_platform",
      uniformToneStyle: "",
      perPlatformTone: { wordpress_blog: "explanatory", x: "curiosity" },
      // x는 이제 체크 해제된 상태 — perPlatformTone에는 옛 값이 남아 있어도 제외되어야 한다.
      checkedPlatforms: ["wordpress_blog"],
    });
    expect(result.perPlatformEntries).toEqual([{ platform: "wordpress_blog", toneStyle: "explanatory" }]);
    expect(result.perPlatformEntries.some((e) => e.platform === "x")).toBe(false);
  });

  it("체크된 플랫폼인데 아직 값이 비어 있으면(빈 문자열) 제외한다", () => {
    const result = computeToneFormFields({
      toneMode: "manual_per_platform",
      uniformToneStyle: "",
      perPlatformTone: { wordpress_blog: "" },
      checkedPlatforms: ["wordpress_blog"],
    });
    expect(result.perPlatformEntries).toEqual([]);
  });

  it("체크된 플랫폼이 하나도 없으면 perPlatformEntries는 빈 배열이다", () => {
    const result = computeToneFormFields({
      toneMode: "manual_per_platform",
      uniformToneStyle: "",
      perPlatformTone: { wordpress_blog: "explanatory" },
      checkedPlatforms: [],
    });
    expect(result.perPlatformEntries).toEqual([]);
  });

  it("same_for_all인데 uniformToneStyle이 빈 문자열이면 null로 정규화한다", () => {
    const result = computeToneFormFields({
      toneMode: "same_for_all",
      uniformToneStyle: "",
      perPlatformTone: {},
      checkedPlatforms: [],
    });
    expect(result.uniformToneStyle).toBeNull();
  });
});
