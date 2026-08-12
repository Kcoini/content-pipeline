import { describe, expect, it } from "vitest";
import { validateRewriteSuggestion } from "./rewrite-suggestion-validator";
import type { CreateRewriteSuggestionInput } from "./social-rewrite-types";

function makeSuggestion(overrides: Partial<CreateRewriteSuggestionInput> = {}): CreateRewriteSuggestionInput {
  return {
    socialPostId: "social-post-1",
    articleId: "article-1",
    platform: "naver_blog",
    toneStyle: "informational",
    suggestionStatus: "ready",
    diagnosis: { performanceStatus: "low" },
    suggestedChanges: { improvementTargets: ["hook_weak"] },
    suggestedTitle: "개선된 제목",
    suggestedHook: "개선된 도입부",
    suggestedCta: "댓글로 남겨주세요",
    ...overrides,
  };
}

describe("validateRewriteSuggestion", () => {
  it("정상적인 제안은 valid=true, blocked=false를 반환한다", () => {
    const result = validateRewriteSuggestion(makeSuggestion());
    expect(result.valid).toBe(true);
    expect(result.blocked).toBe(false);
  });

  it("빈 제안(내용 없음)은 blocked 처리된다", () => {
    const result = validateRewriteSuggestion(
      makeSuggestion({ suggestedTitle: undefined, suggestedHook: undefined, suggestedCta: undefined })
    );
    expect(result.blocked).toBe(true);
    expect(result.valid).toBe(false);
  });

  it("diagnosis/suggested_changes가 비어 있으면 invalid하다", () => {
    const result = validateRewriteSuggestion(makeSuggestion({ diagnosis: {}, suggestedChanges: {} }));
    expect(result.valid).toBe(false);
  });

  it("협박 표현이 포함되면 blocked 처리된다", () => {
    const result = validateRewriteSuggestion(makeSuggestion({ suggestedHook: "당장 하지 않으면 후회하게 될 것입니다" }));
    expect(result.blocked).toBe(true);
  });

  it("광고 클릭 유도 표현이 포함되면 blocked 처리된다", () => {
    const result = validateRewriteSuggestion(makeSuggestion({ suggestedCta: "지금 클릭하세요" }));
    expect(result.blocked).toBe(true);
  });

  it("과장 수익 표현이 포함되면 blocked 처리된다", () => {
    const result = validateRewriteSuggestion(makeSuggestion({ suggestedTitle: "수익 보장 상품" }));
    expect(result.blocked).toBe(true);
  });

  it("지원하지 않는 suggested_tone_style은 invalid하다", () => {
    // @ts-expect-error 의도적으로 잘못된 값을 전달
    const result = validateRewriteSuggestion(makeSuggestion({ suggestedToneStyle: "threat" }));
    expect(result.valid).toBe(false);
  });
});
