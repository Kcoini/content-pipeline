import { describe, expect, it } from "vitest";
import { buildPlatformPublishDryRunPayload } from "./platform-publish-dry-run-builder";
import type { SocialPost } from "./social-platform-types";

function makeSocialPost(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: "social-post-1",
    articleId: "article-1",
    platform: "naver_blog",
    toneStyle: "informational",
    postTitle: "제목",
    postBody: "본문 내용입니다.",
    caption: null,
    excerpt: null,
    hashtags: ["키워드1", "키워드2"],
    threadItems: [],
    cardItems: [],
    mediaRequirements: {},
    platformMetadata: {},
    generationContext: {},
    qualityStatus: "ready",
    qualityScore: 100,
    qualitySummary: {},
    approvalStatus: "approved",
    approvedBy: "editor",
    approvedAt: "2026-01-01T00:00:00.000Z",
    publishStatus: "exported",
    externalPostId: null,
    postUrl: null,
    exportFormat: "naver_blog_markdown_copy",
    exportPayload: { exportTitle: "제목" },
    errorMessage: null,
    generatedAt: "2026-01-01T00:00:00.000Z",
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
    exportStatus: "exported",
    exportedAt: "2026-01-02T00:00:00.000Z",
    exportedBy: "editor",
    exportError: null,
    exportCopyCount: 0,
    lastCopiedAt: null,
    exportNotes: null,
    platformPublishGuardStatus: "ready",
    platformPublishGuardScore: 95,
    platformPublishGuardSummary: {},
    platformPublishGuardError: null,
    platformPublishGuardCheckedAt: "2026-01-03T00:00:00.000Z",
    platformPublishReady: true,
    platformPublishBlockedReason: null,
    platformPublishDryRunStatus: "not_created",
    platformPublishDryRunPayload: {},
    platformPublishDryRunError: null,
    platformPublishDryRunCreatedAt: null,
    platformPublishDryRunCreatedBy: null,
    handoffStatus: "not_started",
    handoffPayload: {},
    handoffNotes: null,
    handoffCompletedAt: null,
    handoffCompletedBy: null,
    handoffError: null,
    ...overrides,
  };
}

describe("buildPlatformPublishDryRunPayload", () => {
  it("wordpress_blog는 wordpress_manual_or_existing_workflow 타입 payload를 반환한다", () => {
    const post = makeSocialPost({ platform: "wordpress_blog" });
    const result = buildPlatformPublishDryRunPayload(post);

    expect(result.ok).toBe(true);
    expect(result.dryRunPayload.type).toBe("wordpress_manual_or_existing_workflow");
    expect(result.dryRunPayload.title).toBe("제목");
    expect(result.dryRunPayload.contentPreviewLength).toBe(post.postBody?.length);
  });

  it("naver_blog는 manual_copy_handoff 타입 payload와 finalChecklist를 반환한다", () => {
    const post = makeSocialPost({ platform: "naver_blog" });
    const result = buildPlatformPublishDryRunPayload(post);

    expect(result.ok).toBe(true);
    expect(result.dryRunPayload.type).toBe("manual_copy_handoff");
    expect(Array.isArray(result.dryRunPayload.finalChecklist)).toBe(true);
  });

  it("naver_cafe는 caution 안내를 포함한다", () => {
    const post = makeSocialPost({ platform: "naver_cafe" });
    const result = buildPlatformPublishDryRunPayload(post);

    expect(result.ok).toBe(true);
    expect(String(result.dryRunPayload.caution)).toContain("카페 규칙");
  });

  it("x는 threadItems/itemLengths/totalItems를 반환한다", () => {
    const post = makeSocialPost({
      platform: "x",
      postBody: null,
      threadItems: [
        { order: 1, text: "첫 트윗" },
        { order: 2, text: "두번째 트윗" },
      ],
    });
    const result = buildPlatformPublishDryRunPayload(post);

    expect(result.ok).toBe(true);
    expect(result.dryRunPayload.type).toBe("x_thread_dry_run");
    expect(result.dryRunPayload.totalItems).toBe(2);
    expect(result.dryRunPayload.itemLengths).toEqual([4, 6]);
  });

  it("x는 280자를 초과하는 thread item에 대해 warning을 반환한다", () => {
    const post = makeSocialPost({
      platform: "x",
      postBody: null,
      threadItems: [{ order: 1, text: "가".repeat(300) }],
    });
    const result = buildPlatformPublishDryRunPayload(post);

    expect(result.ok).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("threads는 threads_post_dry_run 타입 payload를 반환한다", () => {
    const post = makeSocialPost({ platform: "threads", postTitle: null, postBody: "쓰레드 본문" });
    const result = buildPlatformPublishDryRunPayload(post);

    expect(result.ok).toBe(true);
    expect(result.dryRunPayload.type).toBe("threads_post_dry_run");
    expect(result.dryRunPayload.body).toBe("쓰레드 본문");
  });

  it("instagram은 caption/cardItems/mediaRequirements를 반환한다", () => {
    const post = makeSocialPost({
      platform: "instagram",
      postBody: null,
      caption: "인스타 캡션",
      cardItems: [{ order: 1, heading: "카드1", body: "카드 본문1" }],
      mediaRequirements: { requiresImage: true },
    });
    const result = buildPlatformPublishDryRunPayload(post);

    expect(result.ok).toBe(true);
    expect(result.dryRunPayload.type).toBe("instagram_caption_card_handoff");
    expect(result.dryRunPayload.caption).toBe("인스타 캡션");
    expect(result.warnings).toEqual([]);
  });

  it("instagram은 media_requirements.requiresImage가 없으면 warning을 반환한다", () => {
    const post = makeSocialPost({ platform: "instagram", postBody: null, caption: "캡션", mediaRequirements: {} });
    const result = buildPlatformPublishDryRunPayload(post);

    expect(result.ok).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("필수 콘텐츠가 없으면 ok=false를 반환한다", () => {
    const post = makeSocialPost({ platform: "threads", postTitle: null, postBody: null });
    const result = buildPlatformPublishDryRunPayload(post);

    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
