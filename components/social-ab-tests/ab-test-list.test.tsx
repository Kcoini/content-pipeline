import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AbTestList } from "./ab-test-list";
import type { ArticleAbTestListEntry } from "@/lib/social/article-ab-tests-page-service";

function makeEntry(overrides: Record<string, unknown> = {}): ArticleAbTestListEntry {
  return {
    abTest: {
      id: "test-1",
      articleId: "article-1",
      rootSocialPostId: null,
      platform: "wordpress_blog",
      testName: "제목 A/B",
      testDescription: null,
      hypothesis: null,
      testGoal: null,
      primaryMetric: "performance_score",
      secondaryMetrics: [],
      testStatus: "draft",
      testType: "manual",
      comparisonMethod: "manual_metrics",
      winnerSocialPostId: null,
      winnerReason: null,
      resultSummary: {},
      warnings: [],
      createdBy: null,
      startedAt: null,
      endedAt: null,
      reviewedBy: null,
      reviewedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      ...(overrides as Record<string, unknown>),
    },
    variants: [],
  } as unknown as ArticleAbTestListEntry;
}

describe("AbTestList", () => {
  it("A/B test가 없으면 안내 문구를 렌더링한다", () => {
    const html = renderToStaticMarkup(<AbTestList articleId="article-1" entries={[]} />);
    expect(html).toContain("아직 생성된 A/B test draft가 없습니다");
  });

  it("A/B test 목록을 카드로 렌더링한다", () => {
    const html = renderToStaticMarkup(<AbTestList articleId="article-1" entries={[makeEntry()]} />);
    expect(html).toContain("제목 A/B");
    expect(html).toContain("performance_score");
  });
});
