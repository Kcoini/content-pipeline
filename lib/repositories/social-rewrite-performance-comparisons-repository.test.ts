import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SocialRewritePerformanceComparisonRow } from "@/lib/supabase/database.types";

const createServerSupabaseClient = vi.fn();
const updateRewritePerformanceComparisonSummary = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: (...args: unknown[]) => createServerSupabaseClient(...args),
}));
vi.mock("./social-posts-repository", () => ({
  updateRewritePerformanceComparisonSummary: (...args: unknown[]) => updateRewritePerformanceComparisonSummary(...args),
}));

const {
  createRewritePerformanceComparison,
  getRewritePerformanceComparisonById,
  listRewritePerformanceComparisonsByArticle,
  listRewritePerformanceComparisonsByRootSocialPost,
  listRewritePerformanceComparisonsByRewriteSocialPost,
  updateSocialPostRewritePerformanceSummary,
  mapRewritePerformanceComparisonRow,
} = await import("./social-rewrite-performance-comparisons-repository");

function makeComparisonRow(
  overrides: Partial<SocialRewritePerformanceComparisonRow> = {}
): SocialRewritePerformanceComparisonRow {
  return {
    id: "perf-comparison-1",
    article_id: "article-1",
    root_social_post_id: "social-post-1",
    original_social_post_id: "social-post-1",
    rewrite_social_post_id: "social-post-2",
    rewrite_source_suggestion_id: null,
    version_comparison_id: null,
    platform: "naver_blog",
    tone_style: "informational",
    original_version_number: 1,
    rewrite_version_number: 2,

    original_metrics_id: "metrics-1",
    original_measured_at: "2026-01-10T00:00:00.000Z",
    original_views: 100,
    original_impressions: 200,
    original_reach: 150,
    original_likes: 10,
    original_comments: 2,
    original_shares: 1,
    original_saves: 0,
    original_clicks: 5,
    original_profile_visits: 0,
    original_follows: 0,
    original_conversion_count: 0,
    original_engagement_rate: 0.05,
    original_click_through_rate: 0.02,
    original_conversion_rate: null,
    original_performance_score: 50,
    original_performance_status: "average",

    rewrite_metrics_id: "metrics-2",
    rewrite_measured_at: "2026-01-20T00:00:00.000Z",
    rewrite_views: 150,
    rewrite_impressions: 250,
    rewrite_reach: 200,
    rewrite_likes: 20,
    rewrite_comments: 5,
    rewrite_shares: 3,
    rewrite_saves: 1,
    rewrite_clicks: 10,
    rewrite_profile_visits: 0,
    rewrite_follows: 0,
    rewrite_conversion_count: 0,
    rewrite_engagement_rate: 0.08,
    rewrite_click_through_rate: 0.04,
    rewrite_conversion_rate: null,
    rewrite_performance_score: 65,
    rewrite_performance_status: "good",

    comparison_status: "rewrite_won",
    winner: "rewrite",
    performance_score_delta: 15,
    performance_score_delta_rate: 0.3,
    views_delta: 50,
    views_delta_rate: 0.5,
    impressions_delta: 50,
    impressions_delta_rate: 0.25,
    engagement_rate_delta: 0.03,
    click_through_rate_delta: 0.02,
    clicks_delta: 5,
    clicks_delta_rate: 1,
    comments_delta: 3,
    comments_delta_rate: 1.5,
    shares_delta: 2,
    shares_delta_rate: 2,
    saves_delta: 1,
    saves_delta_rate: null,
    improvement_summary: {},
    platform_specific_summary: {},
    warnings: [],
    failures: [],
    compared_by: "editor",
    compared_at: "2026-01-20T00:00:00.000Z",
    created_at: "2026-01-20T00:00:00.000Z",
    updated_at: "2026-01-20T00:00:00.000Z",
    ...overrides,
  };
}

function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.insert = vi.fn(self);
  chain.update = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.order = vi.fn(self);
  chain.single = vi.fn(() => Promise.resolve(result));
  chain.maybeSingle = vi.fn(() => Promise.resolve(result));
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return chain;
}

beforeEach(() => {
  createServerSupabaseClient.mockReset();
  updateRewritePerformanceComparisonSummary.mockReset();
});

describe("createRewritePerformanceComparison", () => {
  it("social_rewrite_performance_comparisons에 row를 insert한다", async () => {
    const row = makeComparisonRow();
    const chain = makeChain({ data: row, error: null });
    const from = vi.fn(() => chain);
    createServerSupabaseClient.mockReturnValue({ from });

    const result = await createRewritePerformanceComparison({
      articleId: "article-1",
      rootSocialPostId: "social-post-1",
      originalSocialPostId: "social-post-1",
      rewriteSocialPostId: "social-post-2",
      platform: "naver_blog",
      comparisonStatus: "rewrite_won",
    });

    expect(from).toHaveBeenCalledWith("social_rewrite_performance_comparisons");
    expect(result.id).toBe("perf-comparison-1");
    expect(result.performanceScoreDelta).toBe(15);
  });
});

describe("getRewritePerformanceComparisonById / list*", () => {
  it("id로 조회한다", async () => {
    const chain = makeChain({ data: makeComparisonRow(), error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const result = await getRewritePerformanceComparisonById("perf-comparison-1");

    expect(result?.id).toBe("perf-comparison-1");
  });

  it("listRewritePerformanceComparisonsByArticle는 article_id 기준으로 조회한다", async () => {
    const chain = makeChain({ data: [makeComparisonRow()], error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const result = await listRewritePerformanceComparisonsByArticle("article-1");

    expect(chain.eq).toHaveBeenCalledWith("article_id", "article-1");
    expect(result).toHaveLength(1);
  });

  it("listRewritePerformanceComparisonsByRootSocialPost는 root_social_post_id 기준으로 조회한다", async () => {
    const chain = makeChain({ data: [makeComparisonRow()], error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const result = await listRewritePerformanceComparisonsByRootSocialPost("social-post-1");

    expect(chain.eq).toHaveBeenCalledWith("root_social_post_id", "social-post-1");
    expect(result).toHaveLength(1);
  });

  it("listRewritePerformanceComparisonsByRewriteSocialPost는 rewrite_social_post_id 기준으로 조회한다", async () => {
    const chain = makeChain({ data: [makeComparisonRow()], error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const result = await listRewritePerformanceComparisonsByRewriteSocialPost("social-post-2");

    expect(chain.eq).toHaveBeenCalledWith("rewrite_social_post_id", "social-post-2");
    expect(result).toHaveLength(1);
  });
});

describe("updateSocialPostRewritePerformanceSummary", () => {
  it("social-posts-repository의 updateRewritePerformanceComparisonSummary를 위임 호출한다", async () => {
    const comparison = mapRewritePerformanceComparisonRow(makeComparisonRow());
    updateRewritePerformanceComparisonSummary.mockResolvedValue({ id: "social-post-2" });

    await updateSocialPostRewritePerformanceSummary("social-post-2", comparison);

    expect(updateRewritePerformanceComparisonSummary).toHaveBeenCalledWith(
      "social-post-2",
      expect.objectContaining({ latestRewritePerformanceComparisonId: "perf-comparison-1", rewritePerformanceComparisonStatus: "rewrite_won" })
    );
  });
});

describe("mapRewritePerformanceComparisonRow", () => {
  it("row를 도메인 타입으로 매핑한다", () => {
    const mapped = mapRewritePerformanceComparisonRow(makeComparisonRow());
    expect(mapped).toMatchObject({ id: "perf-comparison-1", articleId: "article-1", comparisonStatus: "rewrite_won", winner: "rewrite" });
  });
});

describe("보안 요구사항", () => {
  it("comparison row에는 full post body/API key/auth token 필드가 없다", () => {
    const mapped = mapRewritePerformanceComparisonRow(makeComparisonRow());
    const serialized = JSON.stringify(mapped).toLowerCase();
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("api_key");
    expect(serialized).not.toContain("app_password");
  });
});
