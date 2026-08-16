import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SocialPost } from "./social-platform-types";

const getArticleById = vi.fn();
const getSocialPostById = vi.fn();
const listMetricsBySocialPost = vi.fn();
const listRewriteSuggestionsBySocialPost = vi.fn();
const getVersionChain = vi.fn();
const getVersionComparisonById = vi.fn();
const getRewritePerformanceComparisonById = vi.fn();
const listAbTestsBySocialPost = vi.fn();

vi.mock("@/lib/repositories/social-ab-tests-repository", () => ({
  listAbTestsBySocialPost: (...args: unknown[]) => listAbTestsBySocialPost(...args),
}));
vi.mock("@/lib/repositories/article-repository", () => ({
  getArticleById: (...args: unknown[]) => getArticleById(...args),
}));
vi.mock("@/lib/repositories/social-posts-repository", () => ({
  getSocialPostById: (...args: unknown[]) => getSocialPostById(...args),
}));
vi.mock("@/lib/repositories/social-metrics-repository", () => ({
  listMetricsBySocialPost: (...args: unknown[]) => listMetricsBySocialPost(...args),
}));
vi.mock("@/lib/repositories/social-rewrite-suggestions-repository", () => ({
  listRewriteSuggestionsBySocialPost: (...args: unknown[]) => listRewriteSuggestionsBySocialPost(...args),
}));
vi.mock("@/lib/repositories/social-post-versions-repository", () => ({
  getVersionChain: (...args: unknown[]) => getVersionChain(...args),
}));
vi.mock("@/lib/repositories/social-version-comparisons-repository", () => ({
  getVersionComparisonById: (...args: unknown[]) => getVersionComparisonById(...args),
}));
vi.mock("@/lib/repositories/social-rewrite-performance-comparisons-repository", () => ({
  getRewritePerformanceComparisonById: (...args: unknown[]) => getRewritePerformanceComparisonById(...args),
}));

const { getSocialPostDetail } = await import("./social-post-detail-service");

function makePost(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: "post-1",
    articleId: "article-1",
    platform: "wordpress_blog",
    toneStyle: "informational",
    isRewriteVersion: false,
    parentSocialPostId: null,
    rootSocialPostId: null,
    rewriteAppliedFromSocialPostId: null,
    latestVersionComparisonId: null,
    latestRewritePerformanceComparisonId: null,
    postTitle: "제목",
    postBody: "본문",
    caption: null,
    excerpt: null,
    hashtags: [],
    threadItems: [],
    cardItems: [],
    ...overrides,
  } as unknown as SocialPost;
}

beforeEach(() => {
  getArticleById.mockReset();
  getSocialPostById.mockReset();
  listMetricsBySocialPost.mockReset();
  listRewriteSuggestionsBySocialPost.mockReset();
  getVersionChain.mockReset();
  getVersionComparisonById.mockReset();
  getRewritePerformanceComparisonById.mockReset();
  listAbTestsBySocialPost.mockReset();

  getArticleById.mockResolvedValue({ id: "article-1", title: "테스트 기사" });
  listMetricsBySocialPost.mockResolvedValue([]);
  listRewriteSuggestionsBySocialPost.mockResolvedValue([]);
  getVersionChain.mockResolvedValue([]);
  listAbTestsBySocialPost.mockResolvedValue([]);
});

describe("getSocialPostDetail", () => {
  it("social_post가 없으면 null을 반환한다", async () => {
    getSocialPostById.mockResolvedValue(null);

    const result = await getSocialPostDetail("missing");

    expect(result).toBeNull();
  });

  it("social_post와 article 정보를 함께 반환한다", async () => {
    getSocialPostById.mockResolvedValue(makePost());

    const result = await getSocialPostDetail("post-1");

    expect(result?.socialPost.id).toBe("post-1");
    expect(result?.article?.title).toBe("테스트 기사");
  });

  it("content group/type을 platform/isRewriteVersion 기준으로 계산한다", async () => {
    getSocialPostById.mockResolvedValue(makePost({ platform: "wordpress_blog", isRewriteVersion: false }));

    const result = await getSocialPostDetail("post-1");

    expect(result?.contentGroup).toBe("blog");
    expect(result?.contentType).toBe("wordpress_blog");
  });

  it("rewrite version이면 content group이 rewrite다", async () => {
    getSocialPostById.mockResolvedValue(makePost({ platform: "x", isRewriteVersion: true }));

    const result = await getSocialPostDetail("post-1");

    expect(result?.contentGroup).toBe("rewrite");
    expect(result?.contentType).toBe("rewrite_social");
  });

  it("최근 measuredAt 순으로 정렬된 최근 10개 metrics를 반환하고 latestMetrics는 그 첫 번째다", async () => {
    getSocialPostById.mockResolvedValue(makePost());
    listMetricsBySocialPost.mockResolvedValue([
      { id: "m1", measuredAt: "2026-01-01T00:00:00.000Z" },
      { id: "m2", measuredAt: "2026-01-03T00:00:00.000Z" },
      { id: "m3", measuredAt: "2026-01-02T00:00:00.000Z" },
    ]);

    const result = await getSocialPostDetail("post-1");

    expect(result?.recentMetrics.map((m) => m.id)).toEqual(["m2", "m3", "m1"]);
    expect(result?.latestMetrics?.id).toBe("m2");
  });

  it("versionChain을 그대로 반환한다", async () => {
    getSocialPostById.mockResolvedValue(makePost());
    getVersionChain.mockResolvedValue([{ id: "v1", socialPostId: "post-1", versionNumber: 1 }]);

    const result = await getSocialPostDetail("post-1");

    expect(result?.versionChain).toEqual([{ id: "v1", socialPostId: "post-1", versionNumber: 1 }]);
  });

  it("latestVersionComparisonId가 있으면 조회하고, 없으면 조회하지 않는다", async () => {
    getSocialPostById.mockResolvedValue(makePost({ latestVersionComparisonId: "cmp-1" }));
    getVersionComparisonById.mockResolvedValue({ id: "cmp-1" });

    const result = await getSocialPostDetail("post-1");

    expect(getVersionComparisonById).toHaveBeenCalledWith("cmp-1");
    expect(result?.latestVersionComparison).toEqual({ id: "cmp-1" });
  });

  it("latestVersionComparisonId가 없으면 null을 반환하고 조회하지 않는다", async () => {
    getSocialPostById.mockResolvedValue(makePost({ latestVersionComparisonId: null }));

    const result = await getSocialPostDetail("post-1");

    expect(getVersionComparisonById).not.toHaveBeenCalled();
    expect(result?.latestVersionComparison).toBeNull();
  });

  it("related links를 생성한다 (article 하위 4개 페이지 + performance/rewrite deep link)", async () => {
    getSocialPostById.mockResolvedValue(makePost());

    const result = await getSocialPostDetail("post-1");

    expect(result?.relatedLinks.articleOverview).toBe("/articles/article-1");
    expect(result?.relatedLinks.articleBlog).toBe("/articles/article-1/blog");
    expect(result?.relatedLinks.articleSocial).toBe("/articles/article-1/social");
    expect(result?.relatedLinks.articleRewrite).toBe("/articles/article-1/rewrite");
    expect(result?.relatedLinks.articlePerformance).toBe("/articles/article-1/performance");
    expect(result?.relatedLinks.performanceDeepLink).toContain("/articles/article-1/performance?");
    expect(result?.relatedLinks.rewriteDeepLink).toContain("/articles/article-1/rewrite?");
  });

  it("parent/root/original social post가 있으면 상세 링크를 만든다", async () => {
    getSocialPostById.mockResolvedValue(
      makePost({ id: "post-2", parentSocialPostId: "post-1", rootSocialPostId: "post-1", rewriteAppliedFromSocialPostId: "post-1" })
    );

    const result = await getSocialPostDetail("post-2");

    expect(result?.relatedLinks.parentSocialPostDetail).toBe("/social-posts/post-1");
    expect(result?.relatedLinks.rootSocialPostDetail).toBe("/social-posts/post-1");
    expect(result?.relatedLinks.originalSocialPostDetail).toBe("/social-posts/post-1");
  });

  it("root social post가 자기 자신이면 rootSocialPostDetail은 null이다", async () => {
    getSocialPostById.mockResolvedValue(makePost({ id: "post-1", rootSocialPostId: "post-1" }));

    const result = await getSocialPostDetail("post-1");

    expect(result?.relatedLinks.rootSocialPostDetail).toBeNull();
  });
});
