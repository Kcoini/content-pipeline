import { beforeEach, describe, expect, it, vi } from "vitest";

const createAbTest = vi.fn();
const getAbTestById = vi.fn();
const listAbTestsByArticle = vi.fn();
const listAbTestsBySocialPost = vi.fn();
const updateAbTest = vi.fn();
const createAbTestVariant = vi.fn();
const listVariantsByAbTest = vi.fn();
const updateAbTestVariant = vi.fn();
const updateSocialPostAbTestSummary = vi.fn();
const getArticleById = vi.fn();
const getSocialPostById = vi.fn();
const getLatestMetricsBySocialPost = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/social-ab-tests-repository", () => ({
  createAbTest: (...args: unknown[]) => createAbTest(...args),
  getAbTestById: (...args: unknown[]) => getAbTestById(...args),
  listAbTestsByArticle: (...args: unknown[]) => listAbTestsByArticle(...args),
  listAbTestsBySocialPost: (...args: unknown[]) => listAbTestsBySocialPost(...args),
  updateAbTest: (...args: unknown[]) => updateAbTest(...args),
  createAbTestVariant: (...args: unknown[]) => createAbTestVariant(...args),
  listVariantsByAbTest: (...args: unknown[]) => listVariantsByAbTest(...args),
  updateAbTestVariant: (...args: unknown[]) => updateAbTestVariant(...args),
  updateSocialPostAbTestSummary: (...args: unknown[]) => updateSocialPostAbTestSummary(...args),
}));
vi.mock("@/lib/repositories/article-repository", () => ({
  getArticleById: (...args: unknown[]) => getArticleById(...args),
}));
vi.mock("@/lib/repositories/social-posts-repository", () => ({
  getSocialPostById: (...args: unknown[]) => getSocialPostById(...args),
}));
vi.mock("@/lib/repositories/social-metrics-repository", () => ({
  getLatestMetricsBySocialPost: (...args: unknown[]) => getLatestMetricsBySocialPost(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const {
  createAbTestDraft,
  addVariantToAbTest,
  createOriginalVsRewriteAbTest,
  markAbTestReady,
  startAbTest,
  pauseAbTest,
  completeAbTest,
  cancelAbTest,
  refreshAbTestVariantMetrics,
} = await import("./social-ab-test-service");

function makeAbTest(overrides: Record<string, unknown> = {}) {
  return {
    id: "test-1",
    articleId: "article-1",
    rootSocialPostId: null,
    platform: "wordpress_blog",
    testName: "제목 테스트",
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
    ...overrides,
  };
}

function makeSocialPost(overrides: Record<string, unknown> = {}) {
  return {
    id: "post-1",
    articleId: "article-1",
    platform: "wordpress_blog",
    toneStyle: "informational",
    isRewriteVersion: false,
    versionNumber: 1,
    manualPostStatus: "not_recorded",
    postUrl: null,
    latestMetricsId: null,
    latestPerformanceScore: null,
    latestMetricsRecordedAt: null,
    rootSocialPostId: null,
    parentSocialPostId: null,
    ...overrides,
  };
}

function makeVariant(overrides: Record<string, unknown> = {}) {
  return {
    id: "variant-1",
    abTestId: "test-1",
    articleId: "article-1",
    socialPostId: "post-1",
    variantLabel: "원본",
    variantRole: "control",
    variantStatus: "draft",
    platform: "wordpress_blog",
    toneStyle: "informational",
    resultRank: null,
    ...overrides,
  };
}

beforeEach(() => {
  createAbTest.mockReset();
  getAbTestById.mockReset();
  listAbTestsByArticle.mockReset();
  listAbTestsBySocialPost.mockReset();
  updateAbTest.mockReset();
  createAbTestVariant.mockReset();
  listVariantsByAbTest.mockReset();
  updateAbTestVariant.mockReset();
  updateSocialPostAbTestSummary.mockReset();
  getArticleById.mockReset();
  getSocialPostById.mockReset();
  getLatestMetricsBySocialPost.mockReset();
  logEvent.mockReset();

  getArticleById.mockResolvedValue({ id: "article-1", title: "테스트 기사" });
  listVariantsByAbTest.mockResolvedValue([]);
  updateSocialPostAbTestSummary.mockResolvedValue({});
});

describe("createAbTestDraft", () => {
  it("article이 존재하고 platform/test_name이 유효하면 draft를 생성한다", async () => {
    createAbTest.mockResolvedValue(makeAbTest());

    const result = await createAbTestDraft({ articleId: "article-1", platform: "wordpress_blog", testName: "제목 테스트" });

    expect(result.success).toBe(true);
    expect(result.abTest?.id).toBe("test-1");
    expect(createAbTest).toHaveBeenCalledWith(expect.objectContaining({ articleId: "article-1", platform: "wordpress_blog", testName: "제목 테스트" }));
  });

  it("article이 없으면 실패한다", async () => {
    getArticleById.mockResolvedValue(null);

    const result = await createAbTestDraft({ articleId: "missing", platform: "wordpress_blog", testName: "테스트" });

    expect(result.success).toBe(false);
    expect(createAbTest).not.toHaveBeenCalled();
  });

  it("platform이 유효하지 않으면 실패한다", async () => {
    const result = await createAbTestDraft({ articleId: "article-1", platform: "invalid" as never, testName: "테스트" });

    expect(result.success).toBe(false);
  });

  it("test_name이 비어있으면 실패한다", async () => {
    const result = await createAbTestDraft({ articleId: "article-1", platform: "wordpress_blog", testName: "  " });

    expect(result.success).toBe(false);
  });

  it("primary_metric이 유효하지 않으면 실패한다", async () => {
    const result = await createAbTestDraft({
      articleId: "article-1",
      platform: "wordpress_blog",
      testName: "테스트",
      primaryMetric: "invalid_metric" as never,
    });

    expect(result.success).toBe(false);
    expect(createAbTest).not.toHaveBeenCalled();
  });
});

describe("addVariantToAbTest", () => {
  it("social post를 variant로 추가한다", async () => {
    getAbTestById.mockResolvedValue(makeAbTest());
    getSocialPostById.mockResolvedValue(makeSocialPost({ latestMetricsRecordedAt: "2026-01-01T00:00:00.000Z" }));
    listVariantsByAbTest.mockResolvedValue([]);
    createAbTestVariant.mockResolvedValue(makeVariant());

    const result = await addVariantToAbTest("test-1", "post-1", { variantLabel: "원본", variantRole: "control" });

    expect(result.success).toBe(true);
    expect(result.variant?.id).toBe("variant-1");
  });

  it("같은 social post 중복 추가는 차단한다", async () => {
    getAbTestById.mockResolvedValue(makeAbTest());
    getSocialPostById.mockResolvedValue(makeSocialPost());
    listVariantsByAbTest.mockResolvedValue([makeVariant({ socialPostId: "post-1" })]);

    const result = await addVariantToAbTest("test-1", "post-1", { variantLabel: "중복" });

    expect(result.success).toBe(false);
    expect(createAbTestVariant).not.toHaveBeenCalled();
  });

  it("platform이 테스트와 다르면 warning을 반환한다", async () => {
    getAbTestById.mockResolvedValue(makeAbTest({ platform: "wordpress_blog" }));
    getSocialPostById.mockResolvedValue(makeSocialPost({ platform: "x", latestMetricsRecordedAt: "2026-01-01T00:00:00.000Z" }));
    listVariantsByAbTest.mockResolvedValue([]);
    createAbTestVariant.mockResolvedValue(makeVariant({ platform: "x" }));

    const result = await addVariantToAbTest("test-1", "post-1", { variantLabel: "다른 플랫폼" });

    expect(result.success).toBe(true);
    expect(result.warnings?.some((w) => w.includes("platform"))).toBe(true);
  });

  it("A/B test와 social post의 article_id가 다르면 실패한다", async () => {
    getAbTestById.mockResolvedValue(makeAbTest({ articleId: "article-1" }));
    getSocialPostById.mockResolvedValue(makeSocialPost({ articleId: "article-2" }));

    const result = await addVariantToAbTest("test-1", "post-1", { variantLabel: "다른 기사" });

    expect(result.success).toBe(false);
    expect(createAbTestVariant).not.toHaveBeenCalled();
  });
});

describe("createOriginalVsRewriteAbTest", () => {
  it("원본과 rewrite를 control/variant_a로 묶는 draft를 생성한다", async () => {
    getSocialPostById.mockImplementation(async (id: string) => {
      if (id === "original-1") return makeSocialPost({ id: "original-1", isRewriteVersion: false, latestMetricsRecordedAt: "2026-01-01T00:00:00.000Z" });
      if (id === "rewrite-1")
        return makeSocialPost({ id: "rewrite-1", isRewriteVersion: true, latestMetricsRecordedAt: "2026-01-02T00:00:00.000Z" });
      return null;
    });
    getAbTestById.mockResolvedValue(makeAbTest());
    createAbTest.mockResolvedValue(makeAbTest());
    listVariantsByAbTest.mockResolvedValue([]);
    createAbTestVariant.mockImplementation(async (input: { socialPostId: string; variantRole: string }) =>
      makeVariant({ id: `variant-${input.socialPostId}`, socialPostId: input.socialPostId, variantRole: input.variantRole })
    );

    const result = await createOriginalVsRewriteAbTest("original-1", "rewrite-1");

    expect(result.success).toBe(true);
    expect(result.variants).toHaveLength(2);
  });

  it("rewrite social post가 존재하지 않으면 실패한다", async () => {
    getSocialPostById.mockImplementation(async (id: string) => (id === "original-1" ? makeSocialPost({ id: "original-1" }) : null));

    const result = await createOriginalVsRewriteAbTest("original-1", "missing-rewrite");

    expect(result.success).toBe(false);
  });

  it("platform이 다르면 warning을 포함한다", async () => {
    getSocialPostById.mockImplementation(async (id: string) => {
      if (id === "original-1")
        return makeSocialPost({ id: "original-1", platform: "wordpress_blog", isRewriteVersion: false, latestMetricsRecordedAt: "2026-01-01T00:00:00.000Z" });
      if (id === "rewrite-1")
        return makeSocialPost({ id: "rewrite-1", platform: "naver_blog", isRewriteVersion: true, latestMetricsRecordedAt: "2026-01-02T00:00:00.000Z" });
      return null;
    });
    getAbTestById.mockResolvedValue(makeAbTest());
    createAbTest.mockResolvedValue(makeAbTest());
    listVariantsByAbTest.mockResolvedValue([]);
    createAbTestVariant.mockImplementation(async (input: { socialPostId: string; variantRole: string }) =>
      makeVariant({ id: `variant-${input.socialPostId}`, socialPostId: input.socialPostId, variantRole: input.variantRole })
    );

    const result = await createOriginalVsRewriteAbTest("original-1", "rewrite-1");

    expect(result.success).toBe(true);
    expect(result.warnings?.some((w) => w.includes("platform"))).toBe(true);
  });

  it("metrics가 없어도 draft는 생성되고 warning만 남는다", async () => {
    getSocialPostById.mockImplementation(async (id: string) => {
      if (id === "original-1") return makeSocialPost({ id: "original-1", isRewriteVersion: false, latestMetricsRecordedAt: null });
      if (id === "rewrite-1") return makeSocialPost({ id: "rewrite-1", isRewriteVersion: true, latestMetricsRecordedAt: null });
      return null;
    });
    getAbTestById.mockResolvedValue(makeAbTest());
    createAbTest.mockResolvedValue(makeAbTest());
    listVariantsByAbTest.mockResolvedValue([]);
    createAbTestVariant.mockImplementation(async (input: { socialPostId: string; variantRole: string }) =>
      makeVariant({ id: `variant-${input.socialPostId}`, socialPostId: input.socialPostId, variantRole: input.variantRole })
    );

    const result = await createOriginalVsRewriteAbTest("original-1", "rewrite-1");

    expect(result.success).toBe(true);
    expect(result.warnings?.some((w) => w.includes("metrics"))).toBe(true);
  });
});

describe("markAbTestReady", () => {
  it("variant가 2개 이상이면 ready로 전환한다", async () => {
    getAbTestById.mockResolvedValue(makeAbTest({ testStatus: "draft" }));
    listVariantsByAbTest.mockResolvedValue([makeVariant({ id: "v1" }), makeVariant({ id: "v2", socialPostId: "post-2" })]);
    updateAbTest.mockResolvedValue(makeAbTest({ testStatus: "ready" }));

    const result = await markAbTestReady("test-1");

    expect(result.success).toBe(true);
    expect(updateAbTest).toHaveBeenCalledWith("test-1", { testStatus: "ready" });
  });

  it("variant가 1개면 실패한다", async () => {
    getAbTestById.mockResolvedValue(makeAbTest({ testStatus: "draft" }));
    listVariantsByAbTest.mockResolvedValue([makeVariant()]);

    const result = await markAbTestReady("test-1");

    expect(result.success).toBe(false);
    expect(updateAbTest).not.toHaveBeenCalled();
  });

  it("draft 상태가 아니면 실패한다", async () => {
    getAbTestById.mockResolvedValue(makeAbTest({ testStatus: "running" }));

    const result = await markAbTestReady("test-1");

    expect(result.success).toBe(false);
  });
});

describe("상태 전환: start/pause/complete/cancel", () => {
  it("ready → running", async () => {
    getAbTestById.mockResolvedValue(makeAbTest({ testStatus: "ready" }));
    updateAbTest.mockResolvedValue(makeAbTest({ testStatus: "running" }));

    const result = await startAbTest("test-1");

    expect(result.success).toBe(true);
    expect(updateAbTest).toHaveBeenCalledWith("test-1", expect.objectContaining({ testStatus: "running" }));
  });

  it("paused → running (재개)", async () => {
    getAbTestById.mockResolvedValue(makeAbTest({ testStatus: "paused" }));
    updateAbTest.mockResolvedValue(makeAbTest({ testStatus: "running" }));

    const result = await startAbTest("test-1");

    expect(result.success).toBe(true);
  });

  it("draft에서는 시작할 수 없다", async () => {
    getAbTestById.mockResolvedValue(makeAbTest({ testStatus: "draft" }));

    const result = await startAbTest("test-1");

    expect(result.success).toBe(false);
  });

  it("running → paused", async () => {
    getAbTestById.mockResolvedValue(makeAbTest({ testStatus: "running" }));
    updateAbTest.mockResolvedValue(makeAbTest({ testStatus: "paused" }));

    const result = await pauseAbTest("test-1");

    expect(result.success).toBe(true);
  });

  it("running이 아니면 pause 실패한다", async () => {
    getAbTestById.mockResolvedValue(makeAbTest({ testStatus: "draft" }));

    const result = await pauseAbTest("test-1");

    expect(result.success).toBe(false);
  });

  it("running → completed", async () => {
    getAbTestById.mockResolvedValue(makeAbTest({ testStatus: "running" }));
    updateAbTest.mockResolvedValue(makeAbTest({ testStatus: "completed" }));
    listVariantsByAbTest.mockResolvedValue([makeVariant()]);

    const result = await completeAbTest("test-1");

    expect(result.success).toBe(true);
  });

  it("draft → cancelled", async () => {
    getAbTestById.mockResolvedValue(makeAbTest({ testStatus: "draft" }));
    updateAbTest.mockResolvedValue(makeAbTest({ testStatus: "cancelled" }));

    const result = await cancelAbTest("test-1", "계획 변경");

    expect(result.success).toBe(true);
  });

  it("이미 완료된 테스트는 취소할 수 없다", async () => {
    getAbTestById.mockResolvedValue(makeAbTest({ testStatus: "completed" }));

    const result = await cancelAbTest("test-1");

    expect(result.success).toBe(false);
  });
});

describe("refreshAbTestVariantMetrics", () => {
  it("각 variant의 social post 최신 metrics를 반영한다", async () => {
    getAbTestById.mockResolvedValue(makeAbTest());
    listVariantsByAbTest.mockResolvedValue([makeVariant()]);
    getSocialPostById.mockResolvedValue(makeSocialPost({ latestPerformanceScore: 70, latestMetricsRecordedAt: "2026-01-05T00:00:00.000Z" }));
    getLatestMetricsBySocialPost.mockResolvedValue({ id: "metrics-1" });
    updateAbTestVariant.mockResolvedValue(makeVariant({ variantStatus: "measured" }));

    const result = await refreshAbTestVariantMetrics("test-1");

    expect(result.success).toBe(true);
    expect(updateAbTestVariant).toHaveBeenCalledWith(
      "variant-1",
      expect.objectContaining({ latestPerformanceScore: 70, variantStatus: "measured" })
    );
  });
});
