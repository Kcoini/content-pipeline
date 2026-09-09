import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const pageSource = readFileSync(path.join(__dirname, "page.tsx"), "utf8");

describe("article rewrite page (정적 소스 검사, Phase 3-17)", () => {
  it("rewriteSuggestionId/rewriteVersionId/comparisonId/section/returnTo searchParam을 읽는다", () => {
    expect(pageSource).toContain("rewriteSuggestionId?: string");
    expect(pageSource).toContain("rewriteVersionId?: string");
    expect(pageSource).toContain("comparisonId?: string");
    expect(pageSource).toContain("section?: string");
    expect(pageSource).toContain("returnTo?: string");
  });

  it("suggestion/version 카드 모두 강조 표시(getHighlightClassName)를 사용한다", () => {
    expect(pageSource).toContain("getHighlightClassName");
  });

  it("찾을 수 없는 target에 대한 안내(DeepLinkNotice)를 두 종류(suggestion/version) 모두에 사용한다", () => {
    const matches = pageSource.match(/DeepLinkNotice/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("각 action form에 returnTo hidden input을 포함한다", () => {
    expect(pageSource).toContain('name="returnTo"');
  });

  it("ArticleWorkflowNavigation에 returnTo를 전달한다", () => {
    expect(pageSource).toMatch(/ArticleWorkflowNavigation[^>]*returnTo=\{returnTo\}/);
  });
});

describe("article rewrite page pagination (정적 소스 검사, Phase 3-18)", () => {
  it("page/perPage searchParam을 읽고 parsePagination을 사용한다", () => {
    expect(pageSource).toContain("page?: string");
    expect(pageSource).toContain("perPage?: string");
    expect(pageSource).toContain("parsePagination(");
  });

  it("rewriteVersions에 PaginationControls를 렌더링한다 (versionPagination)", () => {
    expect(pageSource).toContain("PaginationControls");
    expect(pageSource).toContain("versionPagination");
  });

  it("targetVersionId가 현재 page에 없으면 이동 링크를 보여준다", () => {
    expect(pageSource).toContain("versionTargetOnDifferentPage");
    expect(pageSource).toContain("versionTargetPage");
  });

  it("상세 페이지(buildSocialPostDetailUrl)로 가는 링크를 포함한다", () => {
    expect(pageSource).toContain("buildSocialPostDetailUrl");
  });
});

describe("article rewrite page 사용자 친화적 표시 (정적 소스 검사, Phase 3-24)", () => {
  it("platform/tone_style을 raw enum이 아니라 PLATFORM_LABELS/TONE_STYLE_CONFIGS 라벨로 표시한다", () => {
    expect(pageSource).toContain('import { PLATFORM_LABELS } from "@/lib/social/platform-generation-recommendations"');
    expect(pageSource).toContain('import { TONE_STYLE_CONFIGS } from "@/lib/social/tone-style-config"');
    expect(pageSource).toContain("PLATFORM_LABELS[s.platform]");
    expect(pageSource).toContain("PLATFORM_LABELS[v.platform]");
    expect(pageSource).toContain("TONE_STYLE_CONFIGS[s.toneStyle].label");
  });

  it("suggestion_status/application_status 같은 raw 상태값을 그대로 노출하지 않고 describeStatusValue로 변환한다", () => {
    expect(pageSource).toContain('import { describeStatusValue, describeStatusField } from "@/lib/social/status-labels"');
    expect(pageSource).not.toMatch(/suggestion_status: \{s\.suggestionStatus\}/);
    expect(pageSource).not.toMatch(/재승인: \{v\.rewriteReapprovalStatus\}/);
    expect(pageSource).toContain("describeStatusValue(s.suggestionStatus)");
    expect(pageSource).toContain("describeStatusValue(v.rewriteReapprovalStatus)");
  });

  it("재작성 버전 카드는 raw 상태값 상세를 '내부 상태값 보기' 접힘 안에 둔다", () => {
    const detailsIndex = pageSource.indexOf("내부 상태값 보기 (관리자용, 기본 접힘)");
    expect(detailsIndex).toBeGreaterThan(0);
    const versionComparisonIndex = pageSource.indexOf("versionComparisonStatus", detailsIndex);
    const reapprovalStatusFieldIndex = pageSource.indexOf('describeStatusField("rewriteReapprovalStatus")', detailsIndex);
    expect(versionComparisonIndex).toBeGreaterThan(detailsIndex);
    expect(reapprovalStatusFieldIndex).toBeGreaterThan(detailsIndex);
  });

  it("섹션 제목이 영어(Rewrite Versions)가 아니라 한국어(재작성 버전)다", () => {
    expect(pageSource).not.toContain("Rewrite Versions (");
    expect(pageSource).toContain("재작성 버전 (");
  });

  it("disabled 버튼에는 title과 항상 보이는 텍스트(helper text)로 이유를 표시한다", () => {
    expect(pageSource).toContain("describeRequestReapprovalDisabledReason");
    expect(pageSource).toContain("describeApproveReapprovalDisabledReason");
    expect(pageSource).toContain("describePrepareReexportDisabledReason");
    expect(pageSource).toContain("describeGenerateReexportDisabledReason");
    expect(pageSource).toContain("describeCompareDisabledReason");
    // hover title
    expect(pageSource).toContain("title={requestReapprovalDisabledReason ?? undefined}");
    // 항상 보이는 helper text 목록
    expect(pageSource).toContain("재승인 요청: {requestReapprovalDisabledReason}");
  });

  it("각 카드의 주요 버튼 하나만 강조되도록 getRewriteSuggestionNextAction/getRewriteVersionNextAction을 사용한다", () => {
    expect(pageSource).toContain(
      'import {\n  getRewriteSuggestionNextAction,\n  getRewriteVersionNextAction,'
    );
    expect(pageSource).toContain("nextAction.kind === \"approve_suggestion\"");
    expect(pageSource).toContain("nextAction.kind === \"request_reapproval\"");
  });

  it("'재Export' 같은 콩글리시 대신 '재내보내기'로 통일한다", () => {
    expect(pageSource).not.toContain("재Export");
    expect(pageSource).toContain("재내보내기 준비");
    expect(pageSource).toContain("재내보내기 만들기");
  });
});
