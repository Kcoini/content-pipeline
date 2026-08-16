import { beforeEach, describe, expect, it, vi } from "vitest";

const getArticleById = vi.fn();
const buildSocialPerformanceDashboard = vi.fn();

vi.mock("@/lib/repositories/article-repository", () => ({
  getArticleById: (...args: unknown[]) => getArticleById(...args),
}));
vi.mock("./social-performance-dashboard-service", () => ({
  buildSocialPerformanceDashboard: (...args: unknown[]) => buildSocialPerformanceDashboard(...args),
}));

const { buildArticlePerformancePageData } = await import("./article-performance-page-service");

beforeEach(() => {
  getArticleById.mockReset();
  buildSocialPerformanceDashboard.mockReset();
  getArticleById.mockResolvedValue({ id: "article-1", title: "테스트" });
});

describe("buildArticlePerformancePageData", () => {
  it("articleId로 필터링된 dashboard를 조회하고 metrics missing/low performance를 포함한다", async () => {
    buildSocialPerformanceDashboard.mockResolvedValue({
      metricsMissingPosts: [{ id: "p1" }],
      lowPerformancePosts: [{ id: "p2" }],
      summary: { rewriteVersionsCount: 1 },
    });

    const { article, dashboard } = await buildArticlePerformancePageData("article-1");

    expect(article?.id).toBe("article-1");
    expect(buildSocialPerformanceDashboard).toHaveBeenCalledWith(
      expect.objectContaining({ articleId: "article-1", includeRewriteVersions: true }),
      "updated_at desc"
    );
    expect(dashboard.metricsMissingPosts).toEqual([{ id: "p1" }]);
    expect(dashboard.lowPerformancePosts).toEqual([{ id: "p2" }]);
  });

  it("article이 없으면 article은 null이지만 dashboard는 그대로 반환한다", async () => {
    getArticleById.mockResolvedValue(undefined);
    buildSocialPerformanceDashboard.mockResolvedValue({ metricsMissingPosts: [], lowPerformancePosts: [] });

    const { article } = await buildArticlePerformancePageData("missing-article");

    expect(article).toBeNull();
  });
});
