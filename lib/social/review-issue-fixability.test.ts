import { describe, expect, it } from "vitest";
import { classifyReviewIssue, summarizeReviewIssues, hasOnlyImplementedAutoFixableIssues } from "./review-issue-fixability";
import type { SocialPostQualityChecklistItem } from "./social-platform-types";

function item(overrides: Partial<SocialPostQualityChecklistItem> = {}): SocialPostQualityChecklistItem {
  return { key: "some_key", label: "라벨", status: "fail", message: "메시지", ...overrides };
}

describe("classifyReviewIssue", () => {
  it("내부 작성용 소제목 문제는 auto_fixable이고 canAutoFix=true다(구현된 sanitizer가 있다)", () => {
    const result = classifyReviewIssue(item({ key: "no_internal_section_headings", status: "fail" }));
    expect(result.fixability).toBe("auto_fixable");
    expect(result.canAutoFix).toBe(true);
    expect(result.blocksApproval).toBe(false);
  });

  it("첫 문단(리드문)이 짧은 문제는 auto_fixable로 분류된다(구현된 자동 수정기는 아직 없다)", () => {
    const result = classifyReviewIssue(item({ key: "news_article_lead_present", status: "fail" }));
    expect(result.fixability).toBe("auto_fixable");
    expect(result.canAutoFix).toBe(false);
    expect(result.requiresUserConfirmation).toBe(true);
  });

  it("markdown 잔여물(naver_cafe escape) 문제는 auto_fixable이고 canAutoFix=true다", () => {
    const result = classifyReviewIssue(item({ key: "naver_cafe_no_markdown_escape", status: "fail" }));
    expect(result.fixability).toBe("auto_fixable");
    expect(result.canAutoFix).toBe(true);
  });

  it("출처 부족 문제는 user_confirmation_required로 분류된다", () => {
    const result = classifyReviewIssue(
      item({ key: "wordpress_blog_single_source_verification_needed_section", status: "fail" })
    );
    expect(result.fixability).toBe("user_confirmation_required");
    expect(result.requiresUserConfirmation).toBe(true);
    expect(result.canAutoFix).toBe(false);
  });

  it("수치/출처 불명 문제(출처 없는 단정)는 user_confirmation_required로 분류된다", () => {
    const result = classifyReviewIssue(item({ key: "news_article_no_unsourced_claim", status: "warning" }));
    expect(result.fixability).toBe("user_confirmation_required");
  });

  it("본문 없음 문제는 blocking으로 분류된다", () => {
    const result = classifyReviewIssue(item({ key: "content_present", status: "blocked" }));
    expect(result.fixability).toBe("blocking");
    expect(result.blocksApproval).toBe(true);
  });

  it("금지 표현(개인정보/협박/광고 클릭 유도)은 blocking으로 분류된다", () => {
    for (const key of ["no_pii_exposure", "no_threat_language", "no_ad_click_bait", "no_income_guarantee"]) {
      const result = classifyReviewIssue(item({ key, status: "blocked" }));
      expect(result.fixability).toBe("blocking");
    }
  });

  it("status가 blocked면 알 수 없는 key라도 항상 blocking이다(안전 우선)", () => {
    const result = classifyReviewIssue(item({ key: "unknown_new_check", status: "blocked" }));
    expect(result.fixability).toBe("blocking");
  });

  it("알 수 없는 key면 안전하게 user_confirmation_required로 분류한다", () => {
    const result = classifyReviewIssue(item({ key: "brand_new_check_nobody_knows", status: "fail" }));
    expect(result.fixability).toBe("user_confirmation_required");
  });

  it("status가 pass면 blocksApproval/requiresUserConfirmation이 모두 false다", () => {
    const result = classifyReviewIssue(item({ key: "no_internal_section_headings", status: "pass" }));
    expect(result.blocksApproval).toBe(false);
    expect(result.requiresUserConfirmation).toBe(false);
  });
});

describe("summarizeReviewIssues", () => {
  it("pass 항목은 결과에서 제외하고, 나머지를 3종류로 나눈다", () => {
    const checklist: SocialPostQualityChecklistItem[] = [
      item({ key: "content_present", status: "pass" }),
      item({ key: "no_internal_section_headings", status: "fail" }),
      item({ key: "wordpress_blog_single_source_verification_needed_section", status: "fail" }),
      item({ key: "no_pii_exposure", status: "blocked" }),
    ];
    const summary = summarizeReviewIssues(checklist);
    expect(summary.autoFixable.map((i) => i.key)).toEqual(["no_internal_section_headings"]);
    expect(summary.userConfirmationRequired.map((i) => i.key)).toEqual([
      "wordpress_blog_single_source_verification_needed_section",
    ]);
    expect(summary.blocking.map((i) => i.key)).toEqual(["no_pii_exposure"]);
  });

  it("문제가 하나도 없으면 세 배열 모두 비어 있다", () => {
    const summary = summarizeReviewIssues([item({ key: "content_present", status: "pass" })]);
    expect(summary.autoFixable).toEqual([]);
    expect(summary.userConfirmationRequired).toEqual([]);
    expect(summary.blocking).toEqual([]);
  });
});

describe("hasOnlyImplementedAutoFixableIssues (Phase 4-28: 글 생성 직후 자동 실행 여부 판단)", () => {
  it("남은 문제가 전부 구현된 auto_fixable(canAutoFix=true)이면 true다", () => {
    const checklist: SocialPostQualityChecklistItem[] = [
      item({ key: "content_present", status: "pass" }),
      item({ key: "no_internal_section_headings", status: "fail" }),
    ];
    expect(hasOnlyImplementedAutoFixableIssues(checklist)).toBe(true);
  });

  it("user_confirmation_required 문제가 하나라도 섞이면 false다", () => {
    const checklist: SocialPostQualityChecklistItem[] = [
      item({ key: "no_internal_section_headings", status: "fail" }),
      item({ key: "wordpress_blog_single_source_verification_needed_section", status: "fail" }),
    ];
    expect(hasOnlyImplementedAutoFixableIssues(checklist)).toBe(false);
  });

  it("blocking 문제가 하나라도 섞이면 false다", () => {
    const checklist: SocialPostQualityChecklistItem[] = [
      item({ key: "no_internal_section_headings", status: "fail" }),
      item({ key: "no_pii_exposure", status: "blocked" }),
    ];
    expect(hasOnlyImplementedAutoFixableIssues(checklist)).toBe(false);
  });

  it("auto_fixable로 분류되지만 아직 구현되지 않은 항목(canAutoFix=false)만 있으면 false다(자동 수정해도 실제로 바뀌는 게 없으므로)", () => {
    const checklist: SocialPostQualityChecklistItem[] = [item({ key: "news_article_lead_present", status: "fail" })];
    expect(hasOnlyImplementedAutoFixableIssues(checklist)).toBe(false);
  });

  it("문제가 하나도 없으면(전부 pass) false다(자동 수정을 실행할 이유가 없다)", () => {
    const checklist: SocialPostQualityChecklistItem[] = [item({ key: "content_present", status: "pass" })];
    expect(hasOnlyImplementedAutoFixableIssues(checklist)).toBe(false);
  });
});
