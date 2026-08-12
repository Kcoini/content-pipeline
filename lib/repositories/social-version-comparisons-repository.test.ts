import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SocialPostVersionComparisonRow } from "@/lib/supabase/database.types";

const createServerSupabaseClient = vi.fn();
const updateVersionComparisonSummary = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: (...args: unknown[]) => createServerSupabaseClient(...args),
}));
vi.mock("./social-posts-repository", () => ({
  updateVersionComparisonSummary: (...args: unknown[]) => updateVersionComparisonSummary(...args),
}));

const {
  createVersionComparison,
  getVersionComparisonById,
  listComparisonsByArticle,
  listComparisonsByRootSocialPost,
  listComparisonsByRewriteSocialPost,
  updateSocialPostVersionComparisonSummary,
  mapSocialPostVersionComparisonRow,
} = await import("./social-version-comparisons-repository");

function makeComparisonRow(overrides: Partial<SocialPostVersionComparisonRow> = {}): SocialPostVersionComparisonRow {
  return {
    id: "comparison-1",
    article_id: "article-1",
    root_social_post_id: "social-post-1",
    original_social_post_id: "social-post-1",
    rewrite_social_post_id: "social-post-2",
    rewrite_source_suggestion_id: null,
    platform: "naver_blog",
    original_version_number: 1,
    rewrite_version_number: 2,
    original_quality_status: "ready",
    original_quality_score: 70,
    rewrite_quality_status: "ready",
    rewrite_quality_score: 90,
    original_performance_status: "not_measured",
    original_performance_score: null,
    rewrite_performance_status: "not_measured",
    rewrite_performance_score: null,
    comparison_status: "rewrite_better",
    comparison_score: 90,
    recommended_social_post_id: "social-post-2",
    recommendation_reason: "rewrite가 더 좋습니다.",
    comparison_summary: {},
    checklist: [],
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
  updateVersionComparisonSummary.mockReset();
});

describe("createVersionComparison", () => {
  it("social_post_version_comparisons에 row를 insert한다", async () => {
    const row = makeComparisonRow();
    const chain = makeChain({ data: row, error: null });
    const from = vi.fn(() => chain);
    createServerSupabaseClient.mockReturnValue({ from });

    const result = await createVersionComparison({
      articleId: "article-1",
      rootSocialPostId: "social-post-1",
      originalSocialPostId: "social-post-1",
      rewriteSocialPostId: "social-post-2",
      platform: "naver_blog",
      comparisonStatus: "rewrite_better",
    });

    expect(from).toHaveBeenCalledWith("social_post_version_comparisons");
    expect(result.id).toBe("comparison-1");
  });
});

describe("getVersionComparisonById / list*", () => {
  it("id로 조회한다", async () => {
    const chain = makeChain({ data: makeComparisonRow(), error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const result = await getVersionComparisonById("comparison-1");

    expect(result?.id).toBe("comparison-1");
  });

  it("listComparisonsByArticle는 article_id 기준으로 조회한다", async () => {
    const chain = makeChain({ data: [makeComparisonRow()], error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const result = await listComparisonsByArticle("article-1");

    expect(chain.eq).toHaveBeenCalledWith("article_id", "article-1");
    expect(result).toHaveLength(1);
  });

  it("listComparisonsByRootSocialPost는 root_social_post_id 기준으로 조회한다", async () => {
    const chain = makeChain({ data: [makeComparisonRow()], error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const result = await listComparisonsByRootSocialPost("social-post-1");

    expect(chain.eq).toHaveBeenCalledWith("root_social_post_id", "social-post-1");
    expect(result).toHaveLength(1);
  });

  it("listComparisonsByRewriteSocialPost는 rewrite_social_post_id 기준으로 조회한다", async () => {
    const chain = makeChain({ data: [makeComparisonRow()], error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const result = await listComparisonsByRewriteSocialPost("social-post-2");

    expect(chain.eq).toHaveBeenCalledWith("rewrite_social_post_id", "social-post-2");
    expect(result).toHaveLength(1);
  });
});

describe("updateSocialPostVersionComparisonSummary", () => {
  it("social-posts-repository의 updateVersionComparisonSummary를 위임 호출한다", async () => {
    const comparison = mapSocialPostVersionComparisonRow(makeComparisonRow());
    updateVersionComparisonSummary.mockResolvedValue({ id: "social-post-2" });

    await updateSocialPostVersionComparisonSummary("social-post-2", comparison);

    expect(updateVersionComparisonSummary).toHaveBeenCalledWith(
      "social-post-2",
      expect.objectContaining({ latestVersionComparisonId: "comparison-1", versionComparisonStatus: "rewrite_better" })
    );
  });
});

describe("mapSocialPostVersionComparisonRow", () => {
  it("row를 도메인 타입으로 매핑한다", () => {
    const mapped = mapSocialPostVersionComparisonRow(makeComparisonRow());
    expect(mapped).toMatchObject({ id: "comparison-1", articleId: "article-1", comparisonStatus: "rewrite_better" });
  });
});
