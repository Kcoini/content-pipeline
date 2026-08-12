import { describe, expect, it } from "vitest";
import { formatSocialPostPreview } from "./social-post-preview-formatters";
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
    qualityStatus: "not_checked",
    qualityScore: null,
    qualitySummary: {},
    approvalStatus: "not_requested",
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
    ...overrides,
  };
}

describe("formatSocialPostPreview", () => {
  it("wordpress_blog는 제목/본문/excerpt를 표시한다", () => {
    const preview = formatSocialPostPreview(
      makeSocialPost({ platform: "wordpress_blog", postTitle: "제목", postBody: "본문", excerpt: "요약" })
    );
    expect(preview.heading).toBe("제목");
    expect(preview.lines.some((l) => l.label === "excerpt" && l.value === "요약")).toBe(true);
  });

  it("x는 thread_items를 번호와 글자 수와 함께 표시한다", () => {
    const preview = formatSocialPostPreview(
      makeSocialPost({ platform: "x", threadItems: [{ order: 1, text: "abc" }] })
    );
    expect(preview.lines[0].label).toContain("#1");
    expect(preview.lines[0].label).toContain("3자");
  });

  it("instagram은 caption/해시태그/card_items를 slide로 표시한다", () => {
    const preview = formatSocialPostPreview(
      makeSocialPost({
        platform: "instagram",
        caption: "캡션",
        hashtags: ["tag1"],
        cardItems: [{ order: 1, heading: "h1", body: "b1" }],
      })
    );
    expect(preview.lines.some((l) => l.label === "caption" && l.value === "캡션")).toBe(true);
    expect(preview.lines.some((l) => l.label.startsWith("slide 1"))).toBe(true);
  });

  it("naver_cafe는 질문/토론 유도 문장을 강조한다", () => {
    const preview = formatSocialPostPreview(
      makeSocialPost({ platform: "naver_cafe", postBody: "이 방법 어떻게 생각하세요? 참고하시면 좋습니다." })
    );
    expect(preview.highlights.length).toBeGreaterThan(0);
  });

  it("모든 플랫폼에서 예외 없이 preview를 생성한다", () => {
    const platforms = ["wordpress_blog", "naver_blog", "naver_cafe", "x", "threads", "instagram"] as const;
    for (const platform of platforms) {
      expect(() => formatSocialPostPreview(makeSocialPost({ platform }))).not.toThrow();
    }
  });
});
