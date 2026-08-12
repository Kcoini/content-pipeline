import { describe, expect, it } from "vitest";
import {
  getCommonPublishingRules,
  getPlatformPublishingRules,
  checkForbiddenPatterns,
  checkPlatformSpecificRisks,
  calculatePublishingGuardScore,
} from "./platform-publishing-rules";
import { SOCIAL_PLATFORMS } from "./social-platform-types";
import type { SocialPost } from "./social-platform-types";

function makeSocialPost(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: "social-post-1",
    articleId: "article-1",
    platform: "naver_blog",
    toneStyle: "informational",
    postTitle: "제목",
    postBody: "본문",
    caption: null,
    excerpt: null,
    hashtags: [],
    threadItems: [],
    cardItems: [],
    mediaRequirements: {},
    platformMetadata: {},
    generationContext: {},
    qualityStatus: "ready",
    qualityScore: 90,
    qualitySummary: {},
    approvalStatus: "approved",
    approvedBy: "editor",
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
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
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
    exportedBy: null,
    exportError: null,
    exportCopyCount: 0,
    lastCopiedAt: null,
    exportNotes: null,
    platformPublishGuardStatus: "not_checked",
    platformPublishGuardScore: null,
    platformPublishGuardSummary: {},
    platformPublishGuardError: null,
    platformPublishGuardCheckedAt: null,
    platformPublishReady: false,
    platformPublishBlockedReason: null,
    ...overrides,
  };
}

describe("getCommonPublishingRules / getPlatformPublishingRules", () => {
  it("공통 규칙 목록이 비어 있지 않다", () => {
    expect(getCommonPublishingRules().length).toBeGreaterThan(0);
  });

  it("모든 플랫폼에 대해 규칙 목록을 반환한다", () => {
    for (const platform of SOCIAL_PLATFORMS) {
      expect(getPlatformPublishingRules(platform).length).toBeGreaterThan(0);
    }
  });
});

describe("checkForbiddenPatterns", () => {
  it("협박/광고클릭유도/과장수익 표현을 감지한다", () => {
    expect(checkForbiddenPatterns("당장 하지 않으면 후회하게 될 것입니다").blocked).toBe(true);
    expect(checkForbiddenPatterns("지금 클릭하세요").blocked).toBe(true);
    expect(checkForbiddenPatterns("수익 보장 상품입니다").blocked).toBe(true);
  });

  it("API key/token으로 의심되는 패턴을 감지한다", () => {
    expect(checkForbiddenPatterns("sk-ant-abc123def456").blocked).toBe(true);
    expect(checkForbiddenPatterns("Authorization: Bearer abc.def.ghi").blocked).toBe(true);
  });

  it("정상적인 텍스트는 blocked=false를 반환한다", () => {
    expect(checkForbiddenPatterns("장기요양보험 신청 절차를 정리했습니다.").blocked).toBe(false);
  });
});

describe("checkPlatformSpecificRisks", () => {
  it("naver_blog는 키워드 도배를 감지한다", () => {
    const post = makeSocialPost({ platform: "naver_blog", postBody: "장기요양보험 ".repeat(20) });
    expect(checkPlatformSpecificRisks(post).length).toBeGreaterThan(0);
  });

  it("naver_cafe는 홍보성 표현을 감지한다", () => {
    const post = makeSocialPost({ platform: "naver_cafe", postBody: "지금 바로 구매 문의주세요" });
    expect(checkPlatformSpecificRisks(post).length).toBeGreaterThan(0);
  });

  it("위험이 없으면 빈 배열을 반환한다", () => {
    const post = makeSocialPost({ platform: "naver_blog", postBody: "정상적인 본문입니다." });
    expect(checkPlatformSpecificRisks(post)).toEqual([]);
  });
});

describe("calculatePublishingGuardScore", () => {
  it("모두 pass면 100점이다", () => {
    expect(calculatePublishingGuardScore([{ status: "pass" }, { status: "pass" }])).toBe(100);
  });

  it("blocked/fail이 있으면 점수가 낮아진다", () => {
    expect(calculatePublishingGuardScore([{ status: "pass" }, { status: "blocked" }])).toBe(50);
  });

  it("빈 체크리스트는 0점이다", () => {
    expect(calculatePublishingGuardScore([])).toBe(0);
  });
});
