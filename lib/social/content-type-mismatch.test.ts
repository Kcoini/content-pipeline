import { describe, expect, it } from "vitest";
import { inferContentShape, detectContentTypeMismatch } from "./content-type-mismatch";

describe("inferContentShape", () => {
  it("관점 + 반론 마커가 모두 있으면 opinion_column_like로 추정한다", () => {
    expect(inferContentShape("필자는 이렇게 생각한다. 물론 다른 시각도 있을 수 있다.")).toBe("opinion_column_like");
  });

  it("관점 마커 없이 충분히 긴 리드문이 있으면 news_or_explainer_like로 추정한다", () => {
    const body = "한국은행은 15일 기준금리를 3%로 인상했다고 밝혔다. 이는 시장 예상과 부합하는 결정이다.";
    expect(inferContentShape(body)).toBe("news_or_explainer_like");
  });

  it("본문이 비어 있으면 unclear다", () => {
    expect(inferContentShape("")).toBe("unclear");
    expect(inferContentShape(null)).toBe("unclear");
  });

  it("짧고 애매한 본문은 unclear다", () => {
    expect(inferContentShape("짧은 글.")).toBe("unclear");
  });
});

describe("detectContentTypeMismatch", () => {
  it("news_article인데 칼럼형 본문이면 확인 필요로 표시하고 opinion_column을 제안한다", () => {
    const result = detectContentTypeMismatch(
      "news_article",
      "필자는 이번 정책이 신중해야 한다고 생각한다. 물론 다른 시각도 있을 수 있다."
    );
    expect(result.mismatched).toBe(true);
    expect(result.suggestedPlatform).toBe("opinion_column");
    expect(result.message).toContain("칼럼형");
  });

  it("opinion_column인데 기사형 본문이면 확인 필요로 표시하고 news_article을 제안한다", () => {
    const result = detectContentTypeMismatch(
      "opinion_column",
      "한국은행은 15일 기준금리를 3%로 인상했다고 밝혔다. 이는 시장 예상과 부합하는 결정이다."
    );
    expect(result.mismatched).toBe(true);
    expect(result.suggestedPlatform).toBe("news_article");
  });

  it("news_article이고 실제로도 기사형 본문이면 불일치가 아니다", () => {
    const result = detectContentTypeMismatch(
      "news_article",
      "한국은행은 15일 기준금리를 3%로 인상했다고 밝혔다. 이는 시장 예상과 부합하는 결정이다."
    );
    expect(result.mismatched).toBe(false);
    expect(result.message).toBeNull();
  });

  it("opinion_column이고 실제로도 칼럼형 본문이면 불일치가 아니다", () => {
    const result = detectContentTypeMismatch(
      "opinion_column",
      "필자는 이번 정책이 신중해야 한다고 생각한다. 물론 다른 시각도 있을 수 있다."
    );
    expect(result.mismatched).toBe(false);
  });

  it("wordpress_blog 등 다른 플랫폼은 이 검사 대상이 아니다(unclear로 인한 오탐 방지)", () => {
    const result = detectContentTypeMismatch("wordpress_blog", "짧은 글.");
    expect(result.mismatched).toBe(false);
  });
});
