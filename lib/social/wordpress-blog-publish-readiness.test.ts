import { describe, expect, it } from "vitest";
import { checkWordPressBlogPublishReadiness } from "./wordpress-blog-publish-readiness";
import type { SocialPost } from "./social-platform-types";

function makePost(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: "post-1",
    articleId: "article-1",
    platform: "wordpress_blog",
    toneStyle: "informational",
    postTitle: "WordPress 게시용 제목입니다",
    postBody: "이 글은 WordPress에 게시할 본문입니다. 충분한 길이를 갖추고 있습니다.",
    caption: null,
    excerpt: null,
    hashtags: [],
    threadItems: [],
    cardItems: [],
    mediaRequirements: {},
    platformMetadata: { seoTitle: "SEO 제목", metaDescription: "메타 설명" },
    generationContext: {},
    qualityStatus: "ready",
    qualityScore: null,
    qualitySummary: {},
    approvalStatus: "approved",
    approvedBy: null,
    approvedAt: null,
    publishStatus: "not_published",
    externalPostId: null,
    postUrl: null,
    exportFormat: null,
    exportPayload: {},
    errorMessage: null,
    generatedAt: null,
    reviewedAt: null,
    publishedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    editedAt: null,
    editedBy: null,
    reviewNotes: null,
    revisionCount: 0,
    lastQualityCheckedAt: null,
    approvalRequestedAt: null,
    rejectionReason: null,
    revokedAt: null,
    revokedReason: null,
    exportStatus: "not_exported",
    exportedAt: null,
    ...overrides,
  } as SocialPost;
}

describe("checkWordPressBlogPublishReadiness", () => {
  it("quality/approval/필드가 모두 갖춰지면 ready=true를 반환한다", () => {
    const result = checkWordPressBlogPublishReadiness(makePost());
    expect(result.ready).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it("quality_status가 ready가 아니면 blocker를 반환한다", () => {
    const result = checkWordPressBlogPublishReadiness(makePost({ qualityStatus: "needs_revision" }));
    expect(result.ready).toBe(false);
    expect(result.blockers.some((b) => b.includes("quality_status"))).toBe(true);
  });

  it("approval_status가 approved가 아니면 blocker를 반환한다", () => {
    const result = checkWordPressBlogPublishReadiness(makePost({ approvalStatus: "pending_review" }));
    expect(result.ready).toBe(false);
    expect(result.blockers.some((b) => b.includes("approval_status"))).toBe(true);
  });

  it("platform이 wordpress_blog가 아니면 blocker를 반환한다", () => {
    const result = checkWordPressBlogPublishReadiness(makePost({ platform: "naver_blog" }));
    expect(result.ready).toBe(false);
    expect(result.blockers.some((b) => b.includes("platform"))).toBe(true);
  });

  it("post_title/post_body가 비어 있으면 blocker를 반환한다", () => {
    const result = checkWordPressBlogPublishReadiness(makePost({ postTitle: "", postBody: "" }));
    expect(result.ready).toBe(false);
    expect(result.blockers.some((b) => b.includes("post_title"))).toBe(true);
  });

  it("seoTitle/metaDescription이 없으면 warning만 남기고 ready는 유지된다", () => {
    const result = checkWordPressBlogPublishReadiness(makePost({ platformMetadata: {} }));
    expect(result.ready).toBe(true);
    expect(result.warnings.some((w) => w.includes("seoTitle"))).toBe(true);
    expect(result.warnings.some((w) => w.includes("metaDescription"))).toBe(true);
  });

  it("금지 표현이 포함되면 blocker를 반환한다", () => {
    const result = checkWordPressBlogPublishReadiness(makePost({ postBody: "지금 클릭하면 수익 보장됩니다" }));
    expect(result.ready).toBe(false);
    expect(result.blockers.some((b) => b.includes("금지 표현"))).toBe(true);
  });

  it("실제 광고 스크립트로 보이는 문자열이 있으면 blocker를 반환한다", () => {
    const result = checkWordPressBlogPublishReadiness(
      makePost({ postBody: "본문입니다 <script>adsbygoogle.push({})</script>" })
    );
    expect(result.ready).toBe(false);
    expect(result.blockers.some((b) => b.includes("광고"))).toBe(true);
  });

  it("AD_SLOT marker가 중복되면 warning을 반환한다", () => {
    const marker = "<!-- AD_SLOT: after_summary -->";
    const result = checkWordPressBlogPublishReadiness(makePost({ postBody: `본문 ${marker} 중간 ${marker} 끝` }));
    expect(result.warnings.some((w) => w.includes("AD_SLOT"))).toBe(true);
  });

  it("seoSignals에 platformMetadata의 seoTitle/metaDescription을 담는다", () => {
    const result = checkWordPressBlogPublishReadiness(makePost());
    expect(result.seoSignals).toEqual({ seoTitle: "SEO 제목", metaDescription: "메타 설명" });
  });

  it("대표 이미지 media ID가 없고 waive도 선택하지 않았으면 warning만 남기고 blocker가 되지 않는다", () => {
    const result = checkWordPressBlogPublishReadiness(makePost());
    expect(result.ready).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.warnings.some((w) => w.includes("대표 이미지가 준비되지 않았습니다"))).toBe(true);
    expect(result.featuredImageSignal).toEqual({ hasMediaId: false, waived: false });
  });

  it("대표 이미지 없이 진행을 선택(waived)하면 전용 warning으로 바뀌고 여전히 blocker가 아니다", () => {
    const result = checkWordPressBlogPublishReadiness(
      makePost({ platformMetadata: { featuredImage: { waived: true } } })
    );
    expect(result.ready).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.warnings.some((w) => w.includes("사용자가 이미지 없이 진행하도록 선택했습니다"))).toBe(true);
    expect(result.warnings.some((w) => w.includes("대표 이미지가 준비되지 않았습니다"))).toBe(false);
    expect(result.featuredImageSignal).toEqual({ hasMediaId: false, waived: true });
  });

  it("media ID가 있으면 대표 이미지 관련 warning이 없다", () => {
    const result = checkWordPressBlogPublishReadiness(
      makePost({ platformMetadata: { featuredImage: { wordpressMediaId: 42 } } })
    );
    expect(result.warnings.some((w) => w.includes("대표 이미지"))).toBe(false);
    expect(result.featuredImageSignal).toEqual({ hasMediaId: true, waived: false });
  });

  it("다른 blocker가 있으면 waive와 무관하게 여전히 ready=false다", () => {
    const result = checkWordPressBlogPublishReadiness(
      makePost({
        qualityStatus: "needs_revision",
        platformMetadata: { featuredImage: { waived: true } },
      })
    );
    expect(result.ready).toBe(false);
    expect(result.blockers.some((b) => b.includes("quality_status"))).toBe(true);
  });

  it("targetKeyword가 없으면 warning을 반환하지만 blocker는 아니다", () => {
    const result = checkWordPressBlogPublishReadiness(makePost());
    expect(result.ready).toBe(true);
    expect(result.warnings.some((w) => w.includes("targetKeyword가 없습니다"))).toBe(true);
  });

  it("title에 clickbait 패턴이 있으면 warning을 반환한다", () => {
    const result = checkWordPressBlogPublishReadiness(makePost({ postTitle: "충격!! 이것만 알면 인생이 바뀐다" }));
    expect(result.warnings.some((w) => w.includes("clickbait"))).toBe(true);
  });

  it("targetKeyword가 본문에 과도하게 반복되면 keyword stuffing warning을 반환한다", () => {
    const keyword = "장기요양보험";
    const body = Array.from({ length: 20 }, () => keyword).join(" ") + " 짧은 본문입니다.";
    const result = checkWordPressBlogPublishReadiness(
      makePost({
        postBody: body,
        platformMetadata: { seoTitle: "SEO 제목", metaDescription: "메타 설명", targetKeyword: keyword },
      })
    );
    expect(result.warnings.some((w) => w.includes("keyword stuffing"))).toBe(true);
  });

  it("policyRiskScore가 임계값을 초과하면 warning을 반환한다 (options로 전달)", () => {
    const result = checkWordPressBlogPublishReadiness(makePost(), { policyRiskScore: 90 });
    expect(result.warnings.some((w) => w.includes("정책 위험도"))).toBe(true);
  });

  it("policyRiskScore를 전달하지 않으면 정책 위험도 검사를 건너뛴다", () => {
    const result = checkWordPressBlogPublishReadiness(makePost());
    expect(result.warnings.some((w) => w.includes("정책 위험도"))).toBe(false);
  });

  it("policyRiskScore가 임계값 이하면 warning이 없다", () => {
    const result = checkWordPressBlogPublishReadiness(makePost(), { policyRiskScore: 10 });
    expect(result.warnings.some((w) => w.includes("정책 위험도"))).toBe(false);
  });
});
