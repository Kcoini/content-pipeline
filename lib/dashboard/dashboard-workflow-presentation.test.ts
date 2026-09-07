import { describe, expect, it } from "vitest";
import {
  getWorkflowStateTone,
  getDashboardStatusSummary,
  getDashboardSectionExpansion,
  getDashboardCurrentStepArea,
  describeThemeStageLabel,
} from "./dashboard-workflow-presentation";
import type { DashboardWorkflowState } from "./source-display";

const ALL_STATES: DashboardWorkflowState[] = [
  "needs_theme",
  "needs_source",
  "ready_to_generate",
  "needs_platform_posts",
  "needs_review",
  "ready_for_publish_prep",
];

describe("getWorkflowStateTone (Phase 3-23-2)", () => {
  it("모든 상태에 대해 톤(색상)을 반환한다", () => {
    for (const state of ALL_STATES) {
      const tone = getWorkflowStateTone(state);
      expect(tone.containerClassName).toBeTruthy();
      expect(tone.badgeLabel).toBeTruthy();
    }
  });

  it("needs_source와 ready_for_publish_prep는 서로 다른 색상을 쓴다(둘 다 파란색 고정이 아니다)", () => {
    const needsSource = getWorkflowStateTone("needs_source");
    const readyForPublish = getWorkflowStateTone("ready_for_publish_prep");
    expect(needsSource.containerClassName).not.toBe(readyForPublish.containerClassName);
    expect(needsSource.containerClassName).toContain("amber");
    expect(readyForPublish.containerClassName).toContain("green");
  });

  it("needs_theme는 회색, needs_review는 노랑, ready_to_generate는 파랑을 쓴다", () => {
    expect(getWorkflowStateTone("needs_theme").containerClassName).toContain("zinc");
    expect(getWorkflowStateTone("needs_review").containerClassName).toContain("amber");
    expect(getWorkflowStateTone("ready_to_generate").containerClassName).toContain("blue");
  });
});

describe("getDashboardStatusSummary (Phase 3-23-2)", () => {
  const baseCtx = {
    themeId: "theme-1",
    articleId: "article-1",
    sourceCount: 0,
    minSourceCount: 3,
    pendingReviewCount: 0,
    approvedCount: 0,
  };

  it("needs_source: 출처 추가 안내와 버튼을 반환한다", () => {
    const summary = getDashboardStatusSummary("needs_source", baseCtx);
    expect(summary.headline).toContain("아직 출처가 없습니다");
    expect(summary.primaryActionLabel).toBe("출처 추가하기");
    expect(summary.primaryActionHref).toBe("#source-url-input");
  });

  it("needs_review일 때는 '기사 작성 가능' 같은 이전 단계 문구가 섞이지 않는다", () => {
    const summary = getDashboardStatusSummary("needs_review", { ...baseCtx, pendingReviewCount: 2 });
    expect(summary.headline).not.toContain("기사 작성 가능");
    expect(summary.headline).not.toContain("기사 작성 불가");
    expect(summary.nextAction).toBe("글 내용을 검토하세요.");
    expect(summary.primaryActionLabel).toBe("검토할 글 보기");
    expect(summary.primaryActionHref).toBe("/articles/article-1/social");
  });

  it("ready_for_publish_prep: 게시 준비 안내와 버튼을 반환한다", () => {
    const summary = getDashboardStatusSummary("ready_for_publish_prep", { ...baseCtx, approvedCount: 1 });
    expect(summary.headline).toContain("승인된 글이 있습니다");
    expect(summary.nextAction).toContain("WordPress Draft 반영 또는 수동 export");
    expect(summary.primaryActionLabel).toBe("게시 준비하기");
    expect(summary.primaryActionHref).toBe("/articles/article-1/blog");
  });

  it("articleId가 없으면 article 링크 대신 안전한 fallback을 준다(article! 없이도 동작)", () => {
    const summary = getDashboardStatusSummary("needs_review", { ...baseCtx, articleId: undefined });
    expect(summary.primaryActionHref).toBe("#platform-generation");
  });

  it("모든 상태는 정확히 하나의 primary action만 가진다", () => {
    for (const state of ALL_STATES) {
      const summary = getDashboardStatusSummary(state, baseCtx);
      expect(summary.primaryActionLabel).toBeTruthy();
      expect(summary.primaryActionHref).toBeTruthy();
    }
  });
});

describe("getDashboardSectionExpansion (Phase 3-23-2 / 3-23-4)", () => {
  it("needs_source 상태에서는 출처 추가 폼이 펼쳐진다", () => {
    const expansion = getDashboardSectionExpansion("needs_source");
    expect(expansion.sourceAddExpanded).toBe(true);
    expect(expansion.draftGenerationExpanded).toBe(false);
    expect(expansion.platformGenerationExpanded).toBe(false);
  });

  it("ready_to_generate 상태에서는 기사 초안 생성 섹션만 펼쳐진다", () => {
    const expansion = getDashboardSectionExpansion("ready_to_generate");
    expect(expansion.sourceAddExpanded).toBe(false);
    expect(expansion.draftGenerationExpanded).toBe(true);
    expect(expansion.platformGenerationExpanded).toBe(false);
  });

  it("needs_platform_posts 상태에서는 플랫폼별 글 생성 섹션만 펼쳐진다", () => {
    const expansion = getDashboardSectionExpansion("needs_platform_posts");
    expect(expansion.draftGenerationExpanded).toBe(false);
    expect(expansion.platformGenerationExpanded).toBe(true);
  });

  it("needs_review/ready_for_publish_prep 상태에서는 출처/초안/플랫폼 생성 폼이 모두 접힌다", () => {
    for (const state of ["needs_review", "ready_for_publish_prep"] as const) {
      const expansion = getDashboardSectionExpansion(state);
      expect(expansion.sourceAddExpanded).toBe(false);
      expect(expansion.draftGenerationExpanded).toBe(false);
      expect(expansion.platformGenerationExpanded).toBe(false);
    }
  });

  it("반환값에 sourceListExpanded 필드가 없다 — 출처 목록은 모든 단계에서 항상 기본 접힘(compact)이다 (Phase 3-23-4)", () => {
    const expansion = getDashboardSectionExpansion("needs_source") as unknown as Record<string, unknown>;
    expect(expansion.sourceListExpanded).toBeUndefined();
  });
});

describe("getDashboardCurrentStepArea (Phase 3-23-4)", () => {
  it("needs_source → source", () => {
    expect(getDashboardCurrentStepArea("needs_source")).toBe("source");
  });

  it("ready_to_generate → draft", () => {
    expect(getDashboardCurrentStepArea("ready_to_generate")).toBe("draft");
  });

  it("needs_platform_posts/needs_review → platform", () => {
    expect(getDashboardCurrentStepArea("needs_platform_posts")).toBe("platform");
    expect(getDashboardCurrentStepArea("needs_review")).toBe("platform");
  });

  it("needs_theme/ready_for_publish_prep → null(세 관리 영역 중 현재 단계 없음)", () => {
    expect(getDashboardCurrentStepArea("needs_theme")).toBeNull();
    expect(getDashboardCurrentStepArea("ready_for_publish_prep")).toBeNull();
  });
});

describe("describeThemeStageLabel (Phase 3-23-3)", () => {
  it("article이 없으면 '생성 전'을 반환한다", () => {
    expect(describeThemeStageLabel({ articleCount: 0, socialPostCount: 0, approvedSocialPostCount: 0 })).toBe(
      "생성 전"
    );
  });

  it("article은 있지만 플랫폼 글이 없으면 '원고 생성됨'을 반환한다", () => {
    expect(describeThemeStageLabel({ articleCount: 1, socialPostCount: 0, approvedSocialPostCount: 0 })).toBe(
      "원고 생성됨"
    );
  });

  it("플랫폼 글이 있지만 승인된 것이 없으면 '검토 대기'를 반환한다", () => {
    expect(describeThemeStageLabel({ articleCount: 1, socialPostCount: 2, approvedSocialPostCount: 0 })).toBe(
      "검토 대기"
    );
  });

  it("승인된 플랫폼 글이 있으면 '승인 N'을 반환한다", () => {
    expect(describeThemeStageLabel({ articleCount: 1, socialPostCount: 3, approvedSocialPostCount: 2 })).toBe(
      "승인 2"
    );
  });
});
