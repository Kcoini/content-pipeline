import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SocialPostMetricsRow, SocialPostRow } from "@/lib/supabase/database.types";

const createServerSupabaseClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: (...args: unknown[]) => createServerSupabaseClient(...args),
}));

const {
  createSocialPostMetrics,
  listMetricsBySocialPost,
  getLatestMetricsBySocialPost,
  updateSocialPostLatestMetrics,
  listMetricsByArticle,
  listPerformanceSummaryByArticle,
  mapSocialPostMetricsRow,
} = await import("./social-metrics-repository");

function makeMetricsRow(overrides: Partial<SocialPostMetricsRow> = {}): SocialPostMetricsRow {
  return {
    id: "metrics-1",
    social_post_id: "social-post-1",
    article_id: "article-1",
    platform: "naver_blog",
    measured_at: "2026-01-10T00:00:00.000Z",
    recorded_by: "editor",
    views: 1000,
    impressions: 0,
    likes: 50,
    comments: 20,
    shares: 10,
    saves: 5,
    clicks: 0,
    profile_visits: 0,
    follows: 0,
    reach: 0,
    engagement_rate: 0.085,
    click_through_rate: null,
    conversion_count: 0,
    conversion_rate: null,
    performance_score: 70,
    notes: null,
    raw_metrics: {},
    created_at: "2026-01-10T00:00:00.000Z",
    updated_at: "2026-01-10T00:00:00.000Z",
    ...overrides,
  };
}

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
    approved_by: null,
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
    latest_metrics_id: null,
    latest_metrics_recorded_at: null,
    latest_views: 0,
    latest_impressions: 0,
    latest_likes: 0,
    latest_comments: 0,
    latest_shares: 0,
    latest_saves: 0,
    latest_clicks: 0,
    latest_engagement_rate: null,
    latest_click_through_rate: null,
    latest_performance_score: null,
    performance_status: "not_measured",
    performance_summary: {},
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
  chain.limit = vi.fn(self);
  chain.single = vi.fn(() => Promise.resolve(result));
  chain.maybeSingle = vi.fn(() => Promise.resolve(result));
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return chain;
}

beforeEach(() => {
  createServerSupabaseClient.mockReset();
});

describe("createSocialPostMetrics", () => {
  it("social_post_metrics에 row를 insert한다", async () => {
    const row = makeMetricsRow();
    const chain = makeChain({ data: row, error: null });
    const from = vi.fn(() => chain);
    createServerSupabaseClient.mockReturnValue({ from });

    const result = await createSocialPostMetrics({
      socialPostId: "social-post-1",
      articleId: "article-1",
      platform: "naver_blog",
      views: 1000,
      likes: 50,
    });

    expect(from).toHaveBeenCalledWith("social_post_metrics");
    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({ social_post_id: "social-post-1", views: 1000 }));
    expect(result.id).toBe("metrics-1");
  });
});

describe("listMetricsBySocialPost / listMetricsByArticle", () => {
  it("social_post_id 기준으로 이력을 조회한다", async () => {
    const rows = [makeMetricsRow(), makeMetricsRow({ id: "metrics-2" })];
    const chain = makeChain({ data: rows, error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const result = await listMetricsBySocialPost("social-post-1");

    expect(chain.eq).toHaveBeenCalledWith("social_post_id", "social-post-1");
    expect(result).toHaveLength(2);
  });

  it("article_id 기준으로 이력을 조회한다", async () => {
    const rows = [makeMetricsRow()];
    const chain = makeChain({ data: rows, error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const result = await listMetricsByArticle("article-1");

    expect(chain.eq).toHaveBeenCalledWith("article_id", "article-1");
    expect(result).toHaveLength(1);
  });
});

describe("getLatestMetricsBySocialPost", () => {
  it("가장 최근 metrics 한 건을 반환한다", async () => {
    const chain = makeChain({ data: makeMetricsRow(), error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const result = await getLatestMetricsBySocialPost("social-post-1");

    expect(result?.id).toBe("metrics-1");
  });

  it("데이터가 없으면 null을 반환한다", async () => {
    const chain = makeChain({ data: null, error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const result = await getLatestMetricsBySocialPost("social-post-1");

    expect(result).toBeNull();
  });
});

describe("updateSocialPostLatestMetrics", () => {
  it("social_posts의 latest_* 컬럼을 갱신한다", async () => {
    const row = makeSocialPostRow();
    const chain = makeChain({ data: row, error: null });
    const from = vi.fn(() => chain);
    createServerSupabaseClient.mockReturnValue({ from });

    await updateSocialPostLatestMetrics("social-post-1", {
      latestMetricsId: "metrics-1",
      latestMetricsRecordedAt: "2026-01-10T00:00:00.000Z",
      latestViews: 1000,
      latestImpressions: 0,
      latestLikes: 50,
      latestComments: 20,
      latestShares: 10,
      latestSaves: 5,
      latestClicks: 0,
      latestEngagementRate: 0.085,
      latestClickThroughRate: null,
      latestPerformanceScore: 70,
      performanceStatus: "good",
      performanceSummary: {},
    });

    expect(from).toHaveBeenCalledWith("social_posts");
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ latest_metrics_id: "metrics-1", latest_views: 1000, performance_status: "good" })
    );
  });
});

describe("listPerformanceSummaryByArticle", () => {
  it("article_id 기준, latest_performance_score 내림차순으로 조회한다", async () => {
    const rows = [makeSocialPostRow({ latest_performance_score: 90 }), makeSocialPostRow({ id: "sp-2", latest_performance_score: 40 })];
    const chain = makeChain({ data: rows, error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const result = await listPerformanceSummaryByArticle("article-1");

    expect(chain.eq).toHaveBeenCalledWith("article_id", "article-1");
    expect(chain.order).toHaveBeenCalledWith("latest_performance_score", { ascending: false });
    expect(result).toHaveLength(2);
  });
});

describe("mapSocialPostMetricsRow", () => {
  it("row를 도메인 타입으로 매핑한다", () => {
    const mapped = mapSocialPostMetricsRow(makeMetricsRow());
    expect(mapped).toMatchObject({ id: "metrics-1", socialPostId: "social-post-1", views: 1000, likes: 50 });
  });
});
