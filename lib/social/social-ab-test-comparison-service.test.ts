import { beforeEach, describe, expect, it, vi } from "vitest";

const getAbTestById = vi.fn();
const listVariantsByAbTest = vi.fn();
const updateAbTest = vi.fn();
const updateAbTestVariant = vi.fn();
const updateSocialPostAbTestSummary = vi.fn();
const getLatestMetricsBySocialPost = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/social-ab-tests-repository", () => ({
  getAbTestById: (...args: unknown[]) => getAbTestById(...args),
  listVariantsByAbTest: (...args: unknown[]) => listVariantsByAbTest(...args),
  updateAbTest: (...args: unknown[]) => updateAbTest(...args),
  updateAbTestVariant: (...args: unknown[]) => updateAbTestVariant(...args),
  updateSocialPostAbTestSummary: (...args: unknown[]) => updateSocialPostAbTestSummary(...args),
}));
vi.mock("@/lib/repositories/social-metrics-repository", () => ({
  getLatestMetricsBySocialPost: (...args: unknown[]) => getLatestMetricsBySocialPost(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { compareAbTestVariants, decideAbTestWinner, buildAbTestComparisonSummary } = await import("./social-ab-test-comparison-service");

function makeAbTest(overrides: Record<string, unknown> = {}) {
  return {
    id: "test-1",
    articleId: "article-1",
    platform: "wordpress_blog",
    testName: "테스트",
    primaryMetric: "performance_score",
    testStatus: "running",
    winnerSocialPostId: null,
    winnerReason: null,
    warnings: [],
    ...overrides,
  };
}

function makeVariant(overrides: Record<string, unknown> = {}) {
  return {
    id: "variant-1",
    socialPostId: "post-1",
    variantLabel: "control",
    variantRole: "control",
    variantStatus: "measured",
    ...overrides,
  };
}

function makeMetrics(overrides: Record<string, unknown> = {}) {
  return {
    performanceScore: null,
    views: 0,
    impressions: 0,
    engagementRate: null,
    clickThroughRate: null,
    clicks: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    conversionRate: null,
    ...overrides,
  };
}

beforeEach(() => {
  getAbTestById.mockReset();
  listVariantsByAbTest.mockReset();
  updateAbTest.mockReset();
  updateAbTestVariant.mockReset();
  updateSocialPostAbTestSummary.mockReset();
  getLatestMetricsBySocialPost.mockReset();
  logEvent.mockReset();
});

describe("compareAbTestVariants", () => {
  it("performance_score 차이가 10점 이상이면 높은 쪽을 winner로 결정한다", async () => {
    getAbTestById.mockResolvedValue(makeAbTest());
    listVariantsByAbTest.mockResolvedValue([
      makeVariant({ id: "v1", socialPostId: "post-1" }),
      makeVariant({ id: "v2", socialPostId: "post-2", variantRole: "variant_a" }),
    ]);
    getLatestMetricsBySocialPost.mockImplementation(async (socialPostId: string) =>
      socialPostId === "post-1" ? makeMetrics({ performanceScore: 80 }) : makeMetrics({ performanceScore: 60 })
    );

    const result = await compareAbTestVariants("test-1");

    expect(result.isInconclusive).toBe(false);
    expect(result.winnerSocialPostId).toBe("post-1");
  });

  it("차이가 10점 미만이면 inconclusive다", async () => {
    getAbTestById.mockResolvedValue(makeAbTest());
    listVariantsByAbTest.mockResolvedValue([makeVariant({ id: "v1", socialPostId: "post-1" }), makeVariant({ id: "v2", socialPostId: "post-2" })]);
    getLatestMetricsBySocialPost.mockImplementation(async (socialPostId: string) =>
      socialPostId === "post-1" ? makeMetrics({ performanceScore: 65 }) : makeMetrics({ performanceScore: 60 })
    );

    const result = await compareAbTestVariants("test-1");

    expect(result.isInconclusive).toBe(true);
    expect(result.winnerSocialPostId).toBeNull();
  });

  it("metrics가 1개 이하면 inconclusive다(데이터 부족)", async () => {
    getAbTestById.mockResolvedValue(makeAbTest());
    listVariantsByAbTest.mockResolvedValue([makeVariant({ id: "v1", socialPostId: "post-1" }), makeVariant({ id: "v2", socialPostId: "post-2" })]);
    getLatestMetricsBySocialPost.mockImplementation(async (socialPostId: string) =>
      socialPostId === "post-1" ? makeMetrics({ performanceScore: 80 }) : null
    );

    const result = await compareAbTestVariants("test-1");

    expect(result.isInconclusive).toBe(true);
    expect(result.winnerSocialPostId).toBeNull();
  });

  it("views 같은 지표는 상대(10%) 차이 기준으로 판단한다", async () => {
    getAbTestById.mockResolvedValue(makeAbTest({ primaryMetric: "views" }));
    listVariantsByAbTest.mockResolvedValue([makeVariant({ id: "v1", socialPostId: "post-1" }), makeVariant({ id: "v2", socialPostId: "post-2" })]);
    getLatestMetricsBySocialPost.mockImplementation(async (socialPostId: string) =>
      socialPostId === "post-1" ? makeMetrics({ views: 1000 }) : makeMetrics({ views: 500 })
    );

    const result = await compareAbTestVariants("test-1");

    expect(result.isInconclusive).toBe(false);
    expect(result.winnerSocialPostId).toBe("post-1");
  });

  it("rank를 값 내림차순으로 매긴다", async () => {
    getAbTestById.mockResolvedValue(makeAbTest());
    listVariantsByAbTest.mockResolvedValue([
      makeVariant({ id: "v1", socialPostId: "post-1" }),
      makeVariant({ id: "v2", socialPostId: "post-2" }),
      makeVariant({ id: "v3", socialPostId: "post-3" }),
    ]);
    getLatestMetricsBySocialPost.mockImplementation(async (socialPostId: string) => {
      const scores: Record<string, number> = { "post-1": 50, "post-2": 90, "post-3": 70 };
      return makeMetrics({ performanceScore: scores[socialPostId] });
    });

    const result = await compareAbTestVariants("test-1");

    const rankByPost = new Map(result.variants.map((v) => [v.socialPostId, v.rank]));
    expect(rankByPost.get("post-2")).toBe(1);
    expect(rankByPost.get("post-3")).toBe(2);
    expect(rankByPost.get("post-1")).toBe(3);
  });
});

describe("decideAbTestWinner", () => {
  it("winner_social_post_id를 업데이트한다", async () => {
    getAbTestById.mockResolvedValue(makeAbTest());
    listVariantsByAbTest.mockResolvedValue([makeVariant({ id: "v1", socialPostId: "post-1" }), makeVariant({ id: "v2", socialPostId: "post-2" })]);
    getLatestMetricsBySocialPost.mockImplementation(async (socialPostId: string) =>
      socialPostId === "post-1" ? makeMetrics({ performanceScore: 90 }) : makeMetrics({ performanceScore: 50 })
    );
    updateAbTest.mockResolvedValue(makeAbTest({ winnerSocialPostId: "post-1" }));

    const result = await decideAbTestWinner("test-1");

    expect(result.success).toBe(true);
    expect(updateAbTest).toHaveBeenCalledWith(
      "test-1",
      expect.objectContaining({ winnerSocialPostId: "post-1", testStatus: "running" })
    );
  });

  it("social_posts의 ab_test_status를 winner/loser로 갱신한다", async () => {
    getAbTestById.mockResolvedValue(makeAbTest());
    listVariantsByAbTest.mockResolvedValue([makeVariant({ id: "v1", socialPostId: "post-1" }), makeVariant({ id: "v2", socialPostId: "post-2" })]);
    getLatestMetricsBySocialPost.mockImplementation(async (socialPostId: string) =>
      socialPostId === "post-1" ? makeMetrics({ performanceScore: 90 }) : makeMetrics({ performanceScore: 50 })
    );
    updateAbTest.mockResolvedValue(makeAbTest({ winnerSocialPostId: "post-1" }));

    await decideAbTestWinner("test-1");

    expect(updateSocialPostAbTestSummary).toHaveBeenCalledWith("post-1", expect.objectContaining({ abTestStatus: "winner" }));
    expect(updateSocialPostAbTestSummary).toHaveBeenCalledWith("post-2", expect.objectContaining({ abTestStatus: "loser" }));
  });

  it("inconclusive면 test_status를 inconclusive로 바꾼다", async () => {
    getAbTestById.mockResolvedValue(makeAbTest());
    listVariantsByAbTest.mockResolvedValue([makeVariant({ id: "v1", socialPostId: "post-1" }), makeVariant({ id: "v2", socialPostId: "post-2" })]);
    getLatestMetricsBySocialPost.mockImplementation(async (socialPostId: string) =>
      socialPostId === "post-1" ? makeMetrics({ performanceScore: 61 }) : makeMetrics({ performanceScore: 60 })
    );
    updateAbTest.mockResolvedValue(makeAbTest({ testStatus: "inconclusive" }));

    const result = await decideAbTestWinner("test-1");

    expect(result.success).toBe(true);
    expect(updateAbTest).toHaveBeenCalledWith("test-1", expect.objectContaining({ testStatus: "inconclusive", winnerSocialPostId: null }));
  });
});

describe("buildAbTestComparisonSummary", () => {
  it("abTest/variants/comparison을 함께 반환한다", async () => {
    getAbTestById.mockResolvedValue(makeAbTest());
    listVariantsByAbTest.mockResolvedValue([makeVariant()]);
    getLatestMetricsBySocialPost.mockResolvedValue(makeMetrics({ performanceScore: 50 }));

    const summary = await buildAbTestComparisonSummary("test-1");

    expect(summary?.abTest.id).toBe("test-1");
    expect(summary?.variants).toHaveLength(1);
    expect(summary?.comparison.abTestId).toBe("test-1");
  });

  it("A/B test가 없으면 null을 반환한다", async () => {
    getAbTestById.mockResolvedValue(null);

    const summary = await buildAbTestComparisonSummary("missing");

    expect(summary).toBeNull();
  });
});
