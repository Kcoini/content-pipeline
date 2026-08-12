import { describe, expect, it } from "vitest";
import { getToneRewriteStrategy } from "./tone-rewrite-strategies";
import { TONE_STYLES } from "./social-platform-types";

describe("getToneRewriteStrategy", () => {
  it("모든 문체에 대해 개선 방향을 반환한다", () => {
    for (const tone of TONE_STYLES) {
      const strategy = getToneRewriteStrategy(tone);
      expect(strategy.improvementDirections.length).toBeGreaterThan(0);
    }
  });

  it("협박형 문체는 존재하지 않는다", () => {
    // @ts-expect-error 의도적으로 잘못된 값을 전달해 타입 목록에 없음을 확인
    expect(TONE_STYLES.includes("threat")).toBe(false);
  });

  it("warning은 위협이 아니라 '위협하지 않기'를 개선 방향으로 제시한다", () => {
    const strategy = getToneRewriteStrategy("warning");
    expect(strategy.improvementDirections.some((d) => d.includes("위협하지"))).toBe(true);
  });

  it("loss_aversion은 과장 손실 표현 제거를 개선 방향으로 제시한다", () => {
    const strategy = getToneRewriteStrategy("loss_aversion");
    expect(strategy.improvementDirections.some((d) => d.includes("과장 손실"))).toBe(true);
  });
});
