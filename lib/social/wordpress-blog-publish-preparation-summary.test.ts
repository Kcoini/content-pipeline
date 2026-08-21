import { beforeEach, describe, expect, it, vi } from "vitest";

const getArticleById = vi.fn();
const getSuccessfulWordPressDraft = vi.fn();

vi.mock("@/lib/repositories/article-repository", () => ({
  getArticleById: (...args: unknown[]) => getArticleById(...args),
}));
vi.mock("@/lib/repositories/publish-repository", () => ({
  getSuccessfulWordPressDraft: (...args: unknown[]) => getSuccessfulWordPressDraft(...args),
}));

const { buildWordPressBlogPublishPreparationSummary, checkFeaturedImageAttachEligibility } = await import(
  "./wordpress-blog-publish-preparation-summary"
);

function makePost(overrides: Record<string, unknown> = {}) {
  return {
    id: "post-1",
    platform: "wordpress_blog",
    qualityStatus: "ready",
    approvalStatus: "approved",
    postTitle: "제목",
    postBody: "본문입니다.",
    platformMetadata: { seoTitle: "플랫폼 SEO 제목", metaDescription: "플랫폼 메타 설명" },
    platformPublishGuardStatus: "ready",
    ...overrides,
  };
}

beforeEach(() => {
  getArticleById.mockReset();
  getSuccessfulWordPressDraft.mockReset();
});

describe("buildWordPressBlogPublishPreparationSummary", () => {
  it("draft가 있으면 postId/postUrl/lastUpdatedAt을 담는다", async () => {
    getArticleById.mockResolvedValue(null);
    getSuccessfulWordPressDraft.mockResolvedValue({
      externalPostId: "123",
      postUrl: "https://example.com/post",
      createdAt: "2026-08-20T02:10:00.000Z",
    });

    const summary = await buildWordPressBlogPublishPreparationSummary("article-1", makePost() as never);

    expect(summary.draft).toEqual({
      exists: true,
      postId: "123",
      postUrl: "https://example.com/post",
      lastUpdatedAt: "2026-08-20T02:10:00.000Z",
    });
  });

  it("draft가 없으면 exists=false를 반환한다", async () => {
    getArticleById.mockResolvedValue(null);
    getSuccessfulWordPressDraft.mockResolvedValue(null);

    const summary = await buildWordPressBlogPublishPreparationSummary("article-1", makePost() as never);

    expect(summary.draft.exists).toBe(false);
  });

  it("article의 SEO 필드가 있으면 우선 사용하고, 없으면 platformMetadata로 대체한다", async () => {
    getSuccessfulWordPressDraft.mockResolvedValue(null);

    getArticleById.mockResolvedValue({
      wpMetadataStatus: "generated",
      seoTitle: "article SEO 제목",
      metaDescription: "article 메타 설명",
      targetKeyword: "키워드",
      featuredImageStatus: "ready",
      featuredImageWordpressMediaId: 42,
    });
    const withArticle = await buildWordPressBlogPublishPreparationSummary("article-1", makePost() as never);
    expect(withArticle.seo.seoTitle).toBe("article SEO 제목");
    expect(withArticle.featuredImage.wordpressMediaId).toBe(42);

    getArticleById.mockResolvedValue(null);
    const withoutArticle = await buildWordPressBlogPublishPreparationSummary("article-1", makePost() as never);
    expect(withoutArticle.seo.seoTitle).toBe("플랫폼 SEO 제목");
  });

  it("post의 platformPublishGuardStatus를 guardStatus로 반환한다", async () => {
    getArticleById.mockResolvedValue(null);
    getSuccessfulWordPressDraft.mockResolvedValue(null);

    const summary = await buildWordPressBlogPublishPreparationSummary(
      "article-1",
      makePost({ platformPublishGuardStatus: "blocked" }) as never
    );

    expect(summary.guardStatus).toBe("blocked");
  });

  it("readiness 결과를 포함한다", async () => {
    getArticleById.mockResolvedValue(null);
    getSuccessfulWordPressDraft.mockResolvedValue(null);

    const summary = await buildWordPressBlogPublishPreparationSummary(
      "article-1",
      makePost({ qualityStatus: "needs_revision" }) as never
    );

    expect(summary.readiness.ready).toBe(false);
  });

  it("featuredImage 요약에 wordpressUrl/attachStatus/attachError/attachedAt/uploadStatus/uploadError를 포함한다", async () => {
    getSuccessfulWordPressDraft.mockResolvedValue(null);
    getArticleById.mockResolvedValue({
      featuredImageStatus: "ready",
      featuredImageWordpressMediaId: 7,
      featuredImageWordpressUrl: "https://example.com/image.jpg",
      wordpressFeaturedMediaAttachStatus: "failed",
      wordpressFeaturedMediaAttachError: "미디어를 찾을 수 없습니다.",
      wordpressFeaturedMediaAttachedAt: "2026-08-20T02:13:00.000Z",
      featuredImageUploadStatus: "uploaded",
      featuredImageUploadError: null,
    });

    const summary = await buildWordPressBlogPublishPreparationSummary("article-1", makePost() as never);

    expect(summary.featuredImage).toEqual({
      status: "ready",
      wordpressMediaId: 7,
      wordpressUrl: "https://example.com/image.jpg",
      attachStatus: "failed",
      attachError: "미디어를 찾을 수 없습니다.",
      attachedAt: "2026-08-20T02:13:00.000Z",
      uploadStatus: "uploaded",
      uploadError: null,
      waived: false,
      waivedReasonCode: null,
      waivedMemo: null,
    });
  });

  it("post.platformMetadata.featuredImage.waived가 true이면 featuredImage.waived/waivedReasonCode/waivedMemo를 반환한다", async () => {
    getSuccessfulWordPressDraft.mockResolvedValue(null);
    getArticleById.mockResolvedValue(null);

    const summary = await buildWordPressBlogPublishPreparationSummary(
      "article-1",
      makePost({
        platformMetadata: {
          featuredImage: { waived: true, waivedReasonCode: "text_focused", waivedMemo: null },
        },
      }) as never
    );

    expect(summary.featuredImage.waived).toBe(true);
    expect(summary.featuredImage.waivedReasonCode).toBe("text_focused");
  });

  it("article.policyRiskScore를 policyRiskScore로 반환한다", async () => {
    getSuccessfulWordPressDraft.mockResolvedValue(null);
    getArticleById.mockResolvedValue({ policyRiskScore: 42 });

    const summary = await buildWordPressBlogPublishPreparationSummary("article-1", makePost() as never);

    expect(summary.policyRiskScore).toBe(42);
  });

  it("article이 없거나 policyRiskScore가 없으면 null을 반환한다", async () => {
    getSuccessfulWordPressDraft.mockResolvedValue(null);
    getArticleById.mockResolvedValue(null);

    const summary = await buildWordPressBlogPublishPreparationSummary("article-1", makePost() as never);

    expect(summary.policyRiskScore).toBeNull();
  });

  it("wordpress_blog 자신의 platformMetadata.policyRiskScore가 있으면 article.policyRiskScore보다 우선한다", async () => {
    getSuccessfulWordPressDraft.mockResolvedValue(null);
    getArticleById.mockResolvedValue({ policyRiskScore: 90 });

    const summary = await buildWordPressBlogPublishPreparationSummary(
      "article-1",
      makePost({ platformMetadata: { policyRiskScore: 5 } }) as never
    );

    expect(summary.policyRiskScore).toBe(5);
  });

  it("blogMetadata는 post.platformMetadata에서만 읽는다 (article 값을 절대 섞지 않음)", async () => {
    getSuccessfulWordPressDraft.mockResolvedValue(null);
    getArticleById.mockResolvedValue({
      seoTitle: "article SEO 제목",
      metaDescription: "article 메타 설명",
      targetKeyword: "article 키워드",
      policyRiskScore: 42,
    });

    const summary = await buildWordPressBlogPublishPreparationSummary(
      "article-1",
      makePost({
        platformMetadata: {
          seoTitle: "블로그 SEO 제목",
          metaDescription: "블로그 메타 설명",
          targetKeyword: "블로그 키워드",
          secondaryKeywords: ["보조1"],
          searchIntent: "informational",
          answerSummary: "짧은 답변",
          eeatNotes: { citedSourceCount: 2 },
          geoSummary: { directAnswer: "짧은 답변", keyFacts: [], caveats: [] },
          structuredDataSuggestions: [],
          adSlots: [],
          monetizationScore: 60,
          policyRiskScore: 8,
        },
      }) as never
    );

    expect(summary.blogMetadata).toEqual({
      seoTitle: "블로그 SEO 제목",
      metaDescription: "블로그 메타 설명",
      targetKeyword: "블로그 키워드",
      secondaryKeywords: ["보조1"],
      searchIntent: "informational",
      readerPersona: null,
      answerSummary: "짧은 답변",
      eeatNotes: { citedSourceCount: 2 },
      geoSummary: { directAnswer: "짧은 답변", keyFacts: [], caveats: [] },
      structuredDataSuggestions: [],
      adSlots: [],
      monetizationScore: 60,
      policyRiskScore: 8,
    });
  });

  it("post.platformMetadata에 값이 없으면 blogMetadata 필드는 null/빈 배열이다 (article 값으로 채우지 않음)", async () => {
    getSuccessfulWordPressDraft.mockResolvedValue(null);
    getArticleById.mockResolvedValue({
      seoTitle: "article SEO 제목",
      metaDescription: "article 메타 설명",
      targetKeyword: "article 키워드",
    });

    const summary = await buildWordPressBlogPublishPreparationSummary("article-1", makePost({ platformMetadata: {} }) as never);

    expect(summary.blogMetadata.seoTitle).toBeNull();
    expect(summary.blogMetadata.metaDescription).toBeNull();
    expect(summary.blogMetadata.targetKeyword).toBeNull();
    expect(summary.blogMetadata.secondaryKeywords).toEqual([]);
  });
});

function makeSummary(overrides: Record<string, unknown> = {}) {
  return {
    readiness: { ready: true, blockers: [], warnings: [], seoSignals: { seoTitle: null, metaDescription: null } },
    draft: { exists: true, postId: "1", postUrl: null },
    seo: { status: "generated", seoTitle: null, metaDescription: null, targetKeyword: null },
    featuredImage: { status: "ready", wordpressMediaId: 7, wordpressUrl: null, attachStatus: "not_attached", attachError: null },
    guardStatus: "ready",
    ...overrides,
  };
}

describe("checkFeaturedImageAttachEligibility", () => {
  it("draft/media id/quality/approval이 모두 갖춰지면 eligible=true를 반환한다", () => {
    const result = checkFeaturedImageAttachEligibility(makeSummary() as never);
    expect(result.eligible).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("draft가 없으면 차단하고 이유를 알려준다", () => {
    const result = checkFeaturedImageAttachEligibility(makeSummary({ draft: { exists: false, postId: null, postUrl: null } }) as never);
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("WordPress Draft가 먼저 필요합니다.");
  });

  it("media id가 없으면 차단하고 이유를 알려준다", () => {
    const result = checkFeaturedImageAttachEligibility(
      makeSummary({ featuredImage: { status: "not_ready", wordpressMediaId: null, wordpressUrl: null, attachStatus: "not_attached", attachError: null } }) as never
    );
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("대표 이미지 media ID를 먼저 입력하세요.");
  });

  it("quality_status 관련 blocker가 있으면 차단 이유에 품질검사 안내를 포함한다", () => {
    const result = checkFeaturedImageAttachEligibility(
      makeSummary({ readiness: { ready: false, blockers: ["quality_status가 ready가 아닙니다 (현재: needs_revision)."], warnings: [], seoSignals: {} } }) as never
    );
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("품질검사를 통과해야 합니다.");
  });

  it("approval_status 관련 blocker가 있으면 차단 이유에 승인 안내를 포함한다", () => {
    const result = checkFeaturedImageAttachEligibility(
      makeSummary({ readiness: { ready: false, blockers: ["approval_status가 approved가 아닙니다 (현재: pending_review)."], warnings: [], seoSignals: {} } }) as never
    );
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("승인 후 연결할 수 있습니다.");
  });
});
