import { describe, expect, it } from "vitest";
import { TONE_TRANSFORMER_RULES, applyToneTransform, getToneTransformerRule } from "./tone-transformer-rules";
import { TONE_STYLES } from "./social-platform-types";

describe("tone transformer rules", () => {
  it("8개 문체 규칙이 모두 존재한다", () => {
    expect(Object.keys(TONE_TRANSFORMER_RULES).sort()).toEqual([...TONE_STYLES].sort());
  });

  it("협박형(threat) 규칙은 존재하지 않는다", () => {
    expect(TONE_TRANSFORMER_RULES).not.toHaveProperty("threat");
  });

  it("applyToneTransform은 문체별로 다른 결과를 만든다", () => {
    const body = "이것은 테스트 본문입니다.";
    const warningResult = applyToneTransform("warning", body);
    const curiosityResult = applyToneTransform("curiosity", body);

    expect(warningResult).not.toBe(curiosityResult);
    expect(warningResult).toContain(body);
    expect(curiosityResult).toContain(body);
  });

  it("warning/loss_aversion 규칙에는 협박성 표현이 opening/closing에 없다", () => {
    const warning = getToneTransformerRule("warning");
    const lossAversion = getToneTransformerRule("loss_aversion");

    expect(warning.opening + warning.closing).not.toContain("협박");
    expect(lossAversion.opening + lossAversion.closing).not.toContain("협박");
  });
});
