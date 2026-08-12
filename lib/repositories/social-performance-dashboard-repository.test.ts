import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SocialPostRow, SocialRewritePerformanceComparisonRow } from "@/lib/supabase/database.types";
import type { DashboardFilter } from "@/lib/social/social-performance-dashboard-types";
import { DEFAULT_DASHBOARD_FILTER } from "@/lib/social/social-performance-dashboard-types";

const createServerSupabaseClient = vi.fn();
const getArticles = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: (...args: unknown[]) => createServerSupabaseClient(...args),
}));
vi.mock("./article-repository", () => ({
  getArticles: (...args: unknown[]) => getArticles(...args),
}));

const {
  listSocialPostsForDashboard,
  getSocialPerformanceDashboardSummary,
  listPlatformPerformanceSummaries,
  listTonePerformanceSummaries,
  listArticlePerformanceSummaries,
  listLowPerformanceSocialPosts,
  listMetricsMissingSocialPosts,
  listRewritePerformanceSummaries,
  listRecentMetrics,
  listRecentRewriteComparisons,
} = await import("./social-performance-dashboard-repository");

function makeSocialPostRow(overrides: Partial<SocialPostRow> = {}): SocialPostRow {
  return {
    id: "social-post-1",
    article_id: "article-1",
    platform: "naver_blog",
    tone_style: "informational",
    post_title: "제목",
    post_body: "본문",
    caption: null,
    excerpt: null,
    hashtags: [],
    thread_items: [],
    card_items: [],
    media_requirements: {},
    platform_metadata: {},
    generation_context: {},
    quality_status: "ready",
    quality_score: 90,
    quality_summary: {},
    approval_status: "approved",
    approved_by: "editor",
    approved_at: null,
    publish_status: "published",
    external_post_id: null,
    post_url: null,
    export_format: null,
    export_payload: {},
    error_message: null,
    generated_at: null,
    reviewed_at: null,
    published_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    edited_at: null,
    edited_by: null,
    review_notes: null,
    revision_count: 0,
    last_quality_checked_at: null,
    approval_requested_at: null,
    rejection_reason: null,
    revoked_at: null,
    revoked_reason: null,
    export_status: "exported",
    exported_at: null,
    exported_by: null,
    export_error: null,
    export_copy_count: 0,
    last_copied_at: null,
    export_notes: null,
    platform_publish_guard_status: "ready",
    platform_publish_guard_score: null,
    platform_publish_guard_summary: {},
    platform_publish_guard_error: null,
    platform_publish_guard_checked_at: null,
    platform_publish_ready: true,
    platform_publish_blocked_reason: null,
    platform_publish_dry_run_status: "ready",
    platform_publish_dry_run_payload: {},
    platform_publish_dry_run_error: null,
    platform_publish_dry_run_created_at: null,
    platform_publish_dry_run_created_by: null,
    handoff_status: "completed",
    handoff_payload: {},
    handoff_notes: null,
    handoff_completed_at: null,
    handoff_completed_by: null,
    handoff_error: null,
    manual_post_status: "posted",
    manual_post_url: null,
    manual_posted_at: null,
    manual_posted_by: null,
    manual_post_result_notes: null,
    manual_post_error: null,
    manual_post_recorded_at: null,
    manual_post_recorded_by: null,
    manual_post_checklist: [],
    latest_metrics_id: "metrics-1",
    latest_metrics_recorded_at: "2026-01-05T00:00:00.000Z",
    latest_views: 100,
    latest_impressions: 200,
    latest_likes: 10,
    latest_comments: 2,
    latest_shares: 1,
    latest_saves: 0,
    latest_clicks: 5,
    latest_engagement_rate: 0.05,
    latest_click_through_rate: 0.02,
    latest_performance_score: 60,
    performance_status: "good",
    performance_summary: {},
    latest_rewrite_suggestion_id: null,
    rewrite_suggestion_status: "not_created",
    rewrite_suggestion_count: 0,
    latest_rewrite_suggested_at: null,
    parent_social_post_id: null,
    root_social_post_id: null,
    version_number: 1,
    version_label: null,
    version_status: "current",
    rewrite_source_suggestion_id: null,
    rewrite_applied_from_social_post_id: null,
    rewrite_applied_at: null,
    rewrite_applied_by: null,
    rewrite_application_notes: null,
    is_rewrite_version: false,
    latest_version_comparison_id: null,
    version_comparison_status: "not_compared",
    version_comparison_score: null,
    recommended_for_repost: false,
    version_comparison_checked_at: null,
    rewrite_reapproval_status: "not_requested",
    rewrite_reapproval_requested_at: null,
    rewrite_reapproval_requested_by: null,
    rewrite_reapproved_at: null,
    rewrite_reapproved_by: null,
    rewrite_reapproval_notes: null,
    rewrite_reapproval_error: null,
    rewrite_reexport_status: "not_started",
    rewrite_reexported_at: null,
    rewrite_reexported_by: null,
    rewrite_reexport_error: null,
    rewrite_republish_workflow_status: "not_started",
    rewrite_republish_workflow_summary: {},
    latest_rewrite_performance_comparison_id: null,
    rewrite_performance_comparison_status: "not_compared",
    rewrite_performance_winner: null,
    rewrite_performance_score_delta: null,
    rewrite_performance_improvement_rate: null,
    rewrite_performance_checked_at: null,
    rewrite_performance_summary: {},
    ...overrides,
  };
}

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
    original_metrics_id: null,
    original_measured_at: null,
    original_views: 100,
    original_impressions: 200,
    original_reach: 0,
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
    rewrite_metrics_id: null,
    rewrite_measured_at: null,
    rewrite_views: 150,
    rewrite_impressions: 250,
    rewrite_reach: 0,
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
  chain.eq = vi.fn(self);
  chain.gte = vi.fn(self);
  chain.lte = vi.fn(self);
  chain.is = vi.fn(self);
  chain.order = vi.fn(self);
  chain.limit = vi.fn(() => Promise.resolve(result));
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return chain;
}

function makeFilter(overrides: Partial<DashboardFilter> = {}): DashboardFilter {
  return { ...DEFAULT_DASHBOARD_FILTER, ...overrides };
}

beforeEach(() => {
  createServerSupabaseClient.mockReset();
  getArticles.mockReset();
  getArticles.mockResolvedValue([]);
});

describe("listSocialPostsForDashboard", () => {
  it("platform 필터를 적용한다", async () => {
    const chain = makeChain({ data: [makeSocialPostRow()], error: null });
    const from = vi.fn(() => chain);
    createServerSupabaseClient.mockReturnValue({ from });

    await listSocialPostsForDashboard(makeFilter({ platform: "naver_blog" }));

    expect(chain.eq).toHaveBeenCalledWith("platform", "naver_blog");
  });

  it("tone_style 필터를 적용한다", async () => {
    const chain = makeChain({ data: [makeSocialPostRow()], error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    await listSocialPostsForDashboard(makeFilter({ toneStyle: "informational" }));

    expect(chain.eq).toHaveBeenCalledWith("tone_style", "informational");
  });

  it("includeRewriteVersions=false이면 rewrite version을 제외한다", async () => {
    const chain = makeChain({ data: [makeSocialPostRow()], error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    await listSocialPostsForDashboard(makeFilter({ includeRewriteVersions: false }));

    expect(chain.eq).toHaveBeenCalledWith("is_rewrite_version", false);
  });

  it("onlyRewriteVersions=true이면 rewrite version만 조회한다", async () => {
    const chain = makeChain({ data: [makeSocialPostRow({ is_rewrite_version: true })], error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    await listSocialPostsForDashboard(makeFilter({ onlyRewriteVersions: true }));

    expect(chain.eq).toHaveBeenCalledWith("is_rewrite_version", true);
  });

  it("onlyMetricsMissing=true이면 posted이면서 latest_metrics_recorded_at이 null인 것만 조회한다", async () => {
    const chain = makeChain({ data: [], error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    await listSocialPostsForDashboard(makeFilter({ onlyMetricsMissing: true }));

    expect(chain.eq).toHaveBeenCalledWith("manual_post_status", "posted");
    expect(chain.is).toHaveBeenCalledWith("latest_metrics_recorded_at", null);
  });

  it("onlyLowPerformance=true이면 low/needs_review/40점 미만만 반환한다", async () => {
    const chain = makeChain({
      data: [
        makeSocialPostRow({ id: "p1", performance_status: "low", latest_performance_score: 60 }),
        makeSocialPostRow({ id: "p2", performance_status: "good", latest_performance_score: 30 }),
        makeSocialPostRow({ id: "p3", performance_status: "good", latest_performance_score: 80 }),
      ],
      error: null,
    });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const result = await listSocialPostsForDashboard(makeFilter({ onlyLowPerformance: true }));

    expect(result.map((p) => p.id).sort()).toEqual(["p1", "p2"]);
  });
});

describe("getSocialPerformanceDashboardSummary", () => {
  it("total/average/합계를 계산한다", async () => {
    const socialPostsChain = makeChain({
      data: [
        makeSocialPostRow({ id: "p1", latest_performance_score: 40, latest_views: 100 }),
        makeSocialPostRow({ id: "p2", latest_performance_score: 60, latest_views: 200 }),
      ],
      error: null,
    });
    const comparisonsChain = makeChain({ data: [makeComparisonRow({ comparison_status: "rewrite_won" })], error: null });
    const from = vi.fn((table: string) => (table === "social_posts" ? socialPostsChain : comparisonsChain));
    createServerSupabaseClient.mockReturnValue({ from });

    const summary = await getSocialPerformanceDashboardSummary(makeFilter());

    expect(summary.totalSocialPosts).toBe(2);
    expect(summary.averagePerformanceScore).toBe(50);
    expect(summary.totalViews).toBe(300);
    expect(summary.rewriteWonCount).toBe(1);
  });
});

describe("listPlatformPerformanceSummaries / listTonePerformanceSummaries", () => {
  it("platform별로 그룹화해 평균/합계를 계산한다", async () => {
    const chain = makeChain({
      data: [
        makeSocialPostRow({ id: "p1", platform: "naver_blog", latest_performance_score: 40 }),
        makeSocialPostRow({ id: "p2", platform: "naver_blog", latest_performance_score: 80 }),
        makeSocialPostRow({ id: "p3", platform: "x", latest_performance_score: 20 }),
      ],
      error: null,
    });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const summaries = await listPlatformPerformanceSummaries(makeFilter());

    const naver = summaries.find((s) => s.platform === "naver_blog");
    expect(naver?.postCount).toBe(2);
    expect(naver?.averagePerformanceScore).toBe(60);
    expect(naver?.bestSocialPostId).toBe("p2");
  });

  it("tone_style별로 그룹화해 평균/합계를 계산한다", async () => {
    const chain = makeChain({
      data: [
        makeSocialPostRow({ id: "p1", tone_style: "informational", latest_performance_score: 30 }),
        makeSocialPostRow({ id: "p2", tone_style: "story", latest_performance_score: 90 }),
      ],
      error: null,
    });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const summaries = await listTonePerformanceSummaries(makeFilter());

    expect(summaries[0].toneStyle).toBe("story");
    expect(summaries[0].averagePerformanceScore).toBe(90);
  });
});

describe("listArticlePerformanceSummaries", () => {
  it("article별로 그룹화하고 article 제목을 붙인다", async () => {
    const chain = makeChain({ data: [makeSocialPostRow({ id: "p1", article_id: "article-1" })], error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });
    getArticles.mockResolvedValue([{ id: "article-1", title: "테스트 기사" }]);

    const summaries = await listArticlePerformanceSummaries(makeFilter());

    expect(summaries[0].articleId).toBe("article-1");
    expect(summaries[0].articleTitle).toBe("테스트 기사");
    expect(summaries[0].socialPostCount).toBe(1);
  });
});

describe("listLowPerformanceSocialPosts / listMetricsMissingSocialPosts", () => {
  it("저성과 목록을 반환한다", async () => {
    const chain = makeChain({ data: [makeSocialPostRow({ performance_status: "low" })], error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const result = await listLowPerformanceSocialPosts(makeFilter());

    expect(result).toHaveLength(1);
    expect(result[0].performanceStatus).toBe("low");
  });

  it("metrics 미입력 목록을 반환한다", async () => {
    const chain = makeChain({
      data: [makeSocialPostRow({ manual_post_status: "posted", latest_metrics_recorded_at: null })],
      error: null,
    });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const result = await listMetricsMissingSocialPosts(makeFilter());

    expect(result).toHaveLength(1);
    expect(result[0].manualPostStatus).toBe("posted");
  });
});

describe("listRewritePerformanceSummaries", () => {
  it("comparison_status별 count와 평균 delta를 계산한다", async () => {
    const chain = makeChain({
      data: [
        makeComparisonRow({ id: "c1", comparison_status: "rewrite_won", performance_score_delta: 10 }),
        makeComparisonRow({ id: "c2", comparison_status: "original_won", performance_score_delta: -20 }),
        makeComparisonRow({ id: "c3", comparison_status: "similar", performance_score_delta: 2 }),
        makeComparisonRow({ id: "c4", comparison_status: "needs_more_data", performance_score_delta: null }),
      ],
      error: null,
    });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const summary = await listRewritePerformanceSummaries(makeFilter());

    expect(summary.rewriteWonCount).toBe(1);
    expect(summary.originalWonCount).toBe(1);
    expect(summary.similarCount).toBe(1);
    expect(summary.needsMoreDataCount).toBe(1);
    expect(summary.averagePerformanceScoreDelta).toBeCloseTo(-8 / 3, 5);
  });
});

describe("listRecentMetrics / listRecentRewriteComparisons", () => {
  it("최근 metrics를 limit과 함께 조회한다", async () => {
    const chain = makeChain({ data: [], error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    await listRecentMetrics(makeFilter());

    expect(chain.limit).toHaveBeenCalled();
  });

  it("최근 rewrite comparison을 limit과 함께 조회한다", async () => {
    const chain = makeChain({ data: [], error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    await listRecentRewriteComparisons(makeFilter());

    expect(chain.limit).toHaveBeenCalled();
  });
});
