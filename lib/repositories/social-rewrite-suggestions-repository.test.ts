import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SocialPostRewriteSuggestionRow, SocialPostRow } from "@/lib/supabase/database.types";

const createServerSupabaseClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: (...args: unknown[]) => createServerSupabaseClient(...args),
}));

const {
  createRewriteSuggestion,
  getRewriteSuggestionById,
  listRewriteSuggestionsBySocialPost,
  listRewriteSuggestionsByArticle,
  updateRewriteSuggestionStatus,
  updateSocialPostRewriteSuggestionSummary,
  mapSocialPostRewriteSuggestionRow,
  updateRewriteSuggestionApplicationStatus,
  markRewriteSuggestionApplied,
  listApplicableRewriteSuggestionsBySocialPost,
} = await import("./social-rewrite-suggestions-repository");

function makeSuggestionRow(overrides: Partial<SocialPostRewriteSuggestionRow> = {}): SocialPostRewriteSuggestionRow {
  return {
    id: "suggestion-1",
    social_post_id: "social-post-1",
    article_id: "article-1",
    platform: "naver_blog",
    tone_style: "informational",
    original_performance_status: "low",
    original_performance_score: 15,
    suggestion_status: "ready",
    diagnosis: {},
    suggested_changes: {},
    suggested_title: "제목",
    suggested_hook: null,
    suggested_body_outline: [],
    suggested_cta: null,
    suggested_hashtags: [],
    suggested_thread_items: [],
    suggested_card_items: [],
    suggested_tone_style: null,
    risk_notes: [],
    quality_notes: [],
    expected_improvement_reason: null,
    generated_by: "mock",
    generated_at: "2026-01-11T00:00:00.000Z",
    reviewed_by: null,
    reviewed_at: null,
    applied_at: null,
    rejected_reason: null,
    created_at: "2026-01-11T00:00:00.000Z",
    updated_at: "2026-01-11T00:00:00.000Z",
    applied_social_post_id: null,
    application_status: "not_applied",
    application_error: null,
    application_notes: null,
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
    latest_performance_score: 15,
    performance_status: "low",
    performance_summary: {},
    latest_rewrite_suggestion_id: null,
    rewrite_suggestion_status: "not_created",
    rewrite_suggestion_count: 0,
    latest_rewrite_suggested_at: null,
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
});

describe("createRewriteSuggestion", () => {
  it("social_post_rewrite_suggestions에 row를 insert한다", async () => {
    const row = makeSuggestionRow();
    const chain = makeChain({ data: row, error: null });
    const from = vi.fn(() => chain);
    createServerSupabaseClient.mockReturnValue({ from });

    const result = await createRewriteSuggestion({
      socialPostId: "social-post-1",
      articleId: "article-1",
      platform: "naver_blog",
      toneStyle: "informational",
      suggestionStatus: "ready",
      diagnosis: { performanceStatus: "low" },
      suggestedChanges: { improvementTargets: ["hook_weak"] },
      suggestedTitle: "개선된 제목",
    });

    expect(from).toHaveBeenCalledWith("social_post_rewrite_suggestions");
    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({ social_post_id: "social-post-1", suggestion_status: "ready" }));
    expect(result.id).toBe("suggestion-1");
  });
});

describe("getRewriteSuggestionById / listRewriteSuggestionsBySocialPost / listRewriteSuggestionsByArticle", () => {
  it("id로 조회한다", async () => {
    const chain = makeChain({ data: makeSuggestionRow(), error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const result = await getRewriteSuggestionById("suggestion-1");

    expect(result?.id).toBe("suggestion-1");
  });

  it("social_post_id 기준으로 목록을 조회한다", async () => {
    const chain = makeChain({ data: [makeSuggestionRow()], error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const result = await listRewriteSuggestionsBySocialPost("social-post-1");

    expect(chain.eq).toHaveBeenCalledWith("social_post_id", "social-post-1");
    expect(result).toHaveLength(1);
  });

  it("article_id 기준으로 목록을 조회한다", async () => {
    const chain = makeChain({ data: [makeSuggestionRow()], error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const result = await listRewriteSuggestionsByArticle("article-1");

    expect(chain.eq).toHaveBeenCalledWith("article_id", "article-1");
    expect(result).toHaveLength(1);
  });
});

describe("updateRewriteSuggestionStatus", () => {
  it("approved로 변경 시 reviewed_at을 함께 저장한다", async () => {
    const chain = makeChain({ data: makeSuggestionRow({ suggestion_status: "approved" }), error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const result = await updateRewriteSuggestionStatus("suggestion-1", "approved", { reviewedBy: "editor" });

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ suggestion_status: "approved", reviewed_by: "editor", reviewed_at: expect.any(String) })
    );
    expect(result.suggestionStatus).toBe("approved");
  });

  it("rejected로 변경 시 rejected_reason을 저장한다", async () => {
    const chain = makeChain({ data: makeSuggestionRow({ suggestion_status: "rejected" }), error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    await updateRewriteSuggestionStatus("suggestion-1", "rejected", { rejectedReason: "부적절" });

    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ suggestion_status: "rejected", rejected_reason: "부적절" }));
  });
});

describe("updateSocialPostRewriteSuggestionSummary", () => {
  it("rewrite_suggestion_count를 1 증가시키고 latest_rewrite_suggestion_id를 갱신한다", async () => {
    const selectChain = makeChain({ data: { rewrite_suggestion_count: 2 }, error: null });
    const updateChain = makeChain({ data: makeSocialPostRow({ rewrite_suggestion_count: 3 }), error: null });
    const from = vi.fn().mockReturnValueOnce(selectChain).mockReturnValueOnce(updateChain);
    createServerSupabaseClient.mockReturnValue({ from });

    const suggestion = mapSocialPostRewriteSuggestionRow(makeSuggestionRow());
    const result = await updateSocialPostRewriteSuggestionSummary("social-post-1", suggestion);

    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ latest_rewrite_suggestion_id: "suggestion-1", rewrite_suggestion_count: 3 })
    );
    expect(result.rewriteSuggestionCount).toBe(3);
  });
});

describe("mapSocialPostRewriteSuggestionRow", () => {
  it("row를 도메인 타입으로 매핑한다", () => {
    const mapped = mapSocialPostRewriteSuggestionRow(makeSuggestionRow());
    expect(mapped).toMatchObject({ id: "suggestion-1", socialPostId: "social-post-1", suggestionStatus: "ready" });
  });
});

describe("rewrite application (Phase 3-11)", () => {
  it("updateRewriteSuggestionApplicationStatus는 application_status를 저장한다", async () => {
    const chain = makeChain({ data: makeSuggestionRow({ application_status: "blocked" }), error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const result = await updateRewriteSuggestionApplicationStatus("suggestion-1", {
      applicationStatus: "blocked",
      applicationError: "사유",
    });

    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ application_status: "blocked", application_error: "사유" }));
    expect(result.applicationStatus).toBe("blocked");
  });

  it("markRewriteSuggestionApplied는 suggestion_status/application_status를 applied로 바꾸고 applied_social_post_id를 저장한다", async () => {
    const chain = makeChain({
      data: makeSuggestionRow({ suggestion_status: "applied", application_status: "applied", applied_social_post_id: "social-post-2" }),
      error: null,
    });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const result = await markRewriteSuggestionApplied("suggestion-1", "social-post-2", "적용 메모");

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ suggestion_status: "applied", application_status: "applied", applied_social_post_id: "social-post-2" })
    );
    expect(result.applicationStatus).toBe("applied");
  });

  it("listApplicableRewriteSuggestionsBySocialPost는 approved && not_applied인 것만 조회한다", async () => {
    const rows = [makeSuggestionRow({ suggestion_status: "approved", application_status: "not_applied" })];
    const chain = makeChain({ data: rows, error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const result = await listApplicableRewriteSuggestionsBySocialPost("social-post-1");

    expect(chain.eq).toHaveBeenCalledWith("suggestion_status", "approved");
    expect(chain.eq).toHaveBeenCalledWith("application_status", "not_applied");
    expect(result).toHaveLength(1);
  });
});
