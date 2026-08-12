import { describe, expect, it } from "vitest";
import { PLATFORM_WRITING_TEMPLATES, getPlatformWritingTemplate } from "./platform-writing-templates";
import { SOCIAL_PLATFORMS } from "./social-platform-types";

describe("platform writing templates", () => {
  it("6개 플랫폼 template이 모두 존재한다", () => {
    expect(Object.keys(PLATFORM_WRITING_TEMPLATES).sort()).toEqual([...SOCIAL_PLATFORMS].sort());
  });

  it("x는 thread item 권장 개수(3~7)를 갖는다", () => {
    const template = getPlatformWritingTemplate("x");
    expect(template.minThreadItems).toBe(3);
    expect(template.maxThreadItems).toBe(7);
  });

  it("instagram은 card item 권장 개수(3~5)를 갖는다", () => {
    const template = getPlatformWritingTemplate("instagram");
    expect(template.minCardItems).toBe(3);
    expect(template.maxCardItems).toBe(5);
  });

  it("모든 template은 structureGuidance를 갖는다", () => {
    for (const platform of SOCIAL_PLATFORMS) {
      expect(getPlatformWritingTemplate(platform).structureGuidance.length).toBeGreaterThan(0);
    }
  });
});
