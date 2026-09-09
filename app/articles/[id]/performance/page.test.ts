import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const pageSource = readFileSync(path.join(__dirname, "page.tsx"), "utf8");

describe("article performance page (정적 소스 검사, Phase 3-17)", () => {
  it("metricsTargetId/socialPostId/comparisonId/section/returnTo searchParam을 읽는다", () => {
    expect(pageSource).toContain("metricsTargetId?: string");
    expect(pageSource).toContain("socialPostId?: string");
    expect(pageSource).toContain("comparisonId?: string");
    expect(pageSource).toContain("section?: string");
    expect(pageSource).toContain("returnTo?: string");
  });

  it("찾을 수 없는 target에 대한 안내(DeepLinkNotice)를 사용한다", () => {
    expect(pageSource).toContain("DeepLinkNotice");
  });

  it("성과 비교 실행 폼에 returnTo hidden input을 포함한다", () => {
    expect(pageSource).toContain('name="returnTo"');
  });

  it("ArticleWorkflowNavigation에 returnTo를 전달한다", () => {
    expect(pageSource).toMatch(/ArticleWorkflowNavigation[^>]*returnTo=\{returnTo\}/);
  });
});

describe("article performance page pagination (정적 소스 검사, Phase 3-18)", () => {
  it("page/perPage searchParam을 읽고 parsePagination을 사용한다", () => {
    expect(pageSource).toContain("page?: string");
    expect(pageSource).toContain("perPage?: string");
    expect(pageSource).toContain("parsePagination(");
  });

  it("recentMetrics에 PaginationControls를 렌더링한다", () => {
    expect(pageSource).toContain("PaginationControls");
    expect(pageSource).toContain("recentMetricsPagination");
  });

  it("target social post가 현재 page에 없으면 이동 링크를 보여준다", () => {
    expect(pageSource).toContain("postTargetOnDifferentPage");
    expect(pageSource).toContain("metricsTargetPage");
  });
});

describe("article performance page 한국어 제목/사용자 친화적 설명 (정적 소스 검사, Phase 3-24)", () => {
  it("영어 섹션 제목(Chart Overview/Platform Performance/Tone Performance/Metrics Trend/Original vs Rewrite Comparison)이 한국어로 바뀐다", () => {
    expect(pageSource).not.toContain("Chart Overview");
    expect(pageSource).not.toContain('title="Platform Performance"');
    expect(pageSource).not.toContain('title="Tone Performance"');
    expect(pageSource).not.toContain('title="Metrics Trend"');
    expect(pageSource).not.toContain('title="Original vs Rewrite Comparison"');
    expect(pageSource).toContain("성과 요약");
    expect(pageSource).toContain('title="플랫폼별 성과"');
    expect(pageSource).toContain('title="문체별 성과"');
    expect(pageSource).toContain('title="성과 추이"');
    expect(pageSource).toContain('title="원본과 재작성 글 비교"');
  });

  it("performance_score라는 내부 필드명 대신 사용자 친화적으로 설명한다", () => {
    expect(pageSource).not.toContain("performance_score는 내부 비교용 참고 지표입니다");
    expect(pageSource).toContain("성과 점수는 조회수, 클릭, 반응 등 여러 지표를 비교하기 쉽게 환산한 참고 점수입니다");
  });

  it("rewrite/A-B 테스트 관련 문구가 한국어로 통일된다", () => {
    expect(pageSource).not.toContain("Original vs Rewrite 성과 비교 실행");
    expect(pageSource).toContain("원본과 재작성 글 성과 비교 실행");
    expect(pageSource).not.toContain("Rewrite 관리에서 보기");
    expect(pageSource).not.toContain("Rewrite 관리로 이동");
    expect(pageSource).toContain("재작성 관리에서 보기");
    expect(pageSource).toContain("재작성 관리로 이동");
  });
});
