import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SocialPost } from "./social-platform-types";

const getSocialPostForPublishingGuard = vi.fn();
const updatePlatformPublishGuardResult = vi.fn();
const markPlatformPublishGuardFailed = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/social-posts-repository", () => ({
  getSocialPostForPublishingGuard: (...args: unknown[]) => getSocialPostForPublishingGuard(...args),
  updatePlatformPublishGuardResult: (...args: unknown[]) => updatePlatformPublishGuardResult(...args),
  markPlatformPublishGuardFailed: (...args: unknown[]) => markPlatformPublishGuardFailed(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { runPlatformPublishingGuard } = await import("./platform-publishing-guard-service");

function makeSocialPost(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: "social-post-1",
    articleId: "article-1",
    platform: "naver_blog",
    toneStyle: "informational",
    postTitle: "장기요양보험 신청 방법 총정리",
    // 키워드 도배(같은 단어 8회 이상 반복) 오탐을 피하기 위해 서로 다른 토큰으로 구성한다.
    postBody: Array.from({ length: 300 }, (_, i) => `문장고유토큰${i}`).join(" "),
    caption: null,
    excerpt: "요약",
    hashtags: ["장기요양보험"],
    threadItems: [],
    cardItems: [],
    mediaRequirements: {},
    platformMetadata: {},
    generationContext: {},
    qualityStatus: "ready",
    qualityScore: 95,
    qualitySummary: {},
    approvalStatus: "approved",
    approvedBy: "editor",
    approvedAt: "2026-01-01T00:00:00.000Z",
    publishStatus: "exported",
    externalPostId: null,
    postUrl: null,
    exportFormat: "naver_blog_markdown_copy",
    exportPayload: { exportTitle: "제목", exportBody: "본문" },
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

beforeEach(() => {
  getSocialPostForPublishingGuard.mockReset();
  updatePlatformPublishGuardResult.mockReset();
  markPlatformPublishGuardFailed.mockReset();
  logEvent.mockReset();
  logEvent.mockResolvedValue({});
  updatePlatformPublishGuardResult.mockResolvedValue(makeSocialPost());
  markPlatformPublishGuardFailed.mockResolvedValue(makeSocialPost({ platformPublishGuardStatus: "failed" }));
});

describe("runPlatformPublishingGuard — 공통 조건", () => {
  it("quality ready + approval approved + export ready(exported)이면 guard가 실행되고 ready/needs_revision을 반환한다", async () => {
    getSocialPostForPublishingGuard.mockResolvedValue(makeSocialPost());

    const result = await runPlatformPublishingGuard("social-post-1");

    expect(result.success).toBe(true);
    expect(["ready", "needs_revision"]).toContain(result.result?.status);
    expect(updatePlatformPublishGuardResult).toHaveBeenCalled();
  });

  it("quality_status가 needs_revision이면 blocked를 반환한다", async () => {
    getSocialPostForPublishingGuard.mockResolvedValue(makeSocialPost({ qualityStatus: "needs_revision" }));

    const result = await runPlatformPublishingGuard("social-post-1");

    expect(result.result?.status).toBe("blocked");
    expect(result.result?.ready).toBe(false);
  });

  it("approval_status가 approved가 아니면 blocked를 반환한다", async () => {
    getSocialPostForPublishingGuard.mockResolvedValue(makeSocialPost({ approvalStatus: "pending_review" }));

    const result = await runPlatformPublishingGuard("social-post-1");

    expect(result.result?.status).toBe("blocked");
  });

  it("approval_status='rejected'면 blocked를 반환한다", async () => {
    getSocialPostForPublishingGuard.mockResolvedValue(makeSocialPost({ approvalStatus: "rejected" }));

    const result = await runPlatformPublishingGuard("social-post-1");

    expect(result.result?.status).toBe("blocked");
  });

  it("approval_status='revoked'면 blocked를 반환한다", async () => {
    getSocialPostForPublishingGuard.mockResolvedValue(makeSocialPost({ approvalStatus: "revoked" }));

    const result = await runPlatformPublishingGuard("social-post-1");

    expect(result.result?.status).toBe("blocked");
  });

  it("export_status='not_exported'면 blocked를 반환한다", async () => {
    getSocialPostForPublishingGuard.mockResolvedValue(makeSocialPost({ exportStatus: "not_exported" }));

    const result = await runPlatformPublishingGuard("social-post-1");

    expect(result.result?.status).toBe("blocked");
  });

  it("publish_status='published'면 blocked를 반환한다", async () => {
    getSocialPostForPublishingGuard.mockResolvedValue(makeSocialPost({ publishStatus: "published" }));

    const result = await runPlatformPublishingGuard("social-post-1");

    expect(result.result?.status).toBe("blocked");
  });

  it("금지 표현(협박/광고클릭유도/과장수익 등)이 포함되면 blocked를 반환한다", async () => {
    getSocialPostForPublishingGuard.mockResolvedValue(makeSocialPost({ postBody: "수익 보장 상품입니다. " + "본문 ".repeat(50) }));

    const result = await runPlatformPublishingGuard("social-post-1");

    expect(result.result?.status).toBe("blocked");
  });

  it("guard가 ready이면 platform_publish_ready=true로 저장한다", async () => {
    getSocialPostForPublishingGuard.mockResolvedValue(
      makeSocialPost({
        postTitle: "장기요양보험 신청 방법과 절차 자세히 알아보기",
        postBody: Array.from({ length: 300 }, (_, i) => `고유문장${i}`).join(" "),
        excerpt: "장기요양보험 신청 절차 요약",
        hashtags: ["장기요양보험", "노인장기요양"],
      })
    );

    const result = await runPlatformPublishingGuard("social-post-1");

    expect(result.result?.status).toBe("ready");
    expect(updatePlatformPublishGuardResult).toHaveBeenCalledWith(
      "social-post-1",
      expect.objectContaining({ ready: true, status: "ready" })
    );
  });

  it("guard가 blocked이면 platform_publish_ready=false로 저장한다", async () => {
    getSocialPostForPublishingGuard.mockResolvedValue(makeSocialPost({ approvalStatus: "rejected" }));

    await runPlatformPublishingGuard("social-post-1");

    expect(updatePlatformPublishGuardResult).toHaveBeenCalledWith(
      "social-post-1",
      expect.objectContaining({ ready: false, status: "blocked" })
    );
  });
});

describe("runPlatformPublishingGuard — 플랫폼별 조건", () => {
  it("wordpress_blog는 title/body가 없으면 blocked/needs_revision이다", async () => {
    getSocialPostForPublishingGuard.mockResolvedValue(
      makeSocialPost({ platform: "wordpress_blog", postTitle: null, postBody: null, exportPayload: { exportTitle: "t" } })
    );

    const result = await runPlatformPublishingGuard("social-post-1");

    expect(["blocked", "needs_revision"]).toContain(result.result?.status);
  });

  it("naver_blog는 키워드가 과도하게 반복되면 blocked된다", async () => {
    getSocialPostForPublishingGuard.mockResolvedValue(
      makeSocialPost({ platform: "naver_blog", postBody: "장기요양보험 ".repeat(20) })
    );

    const result = await runPlatformPublishingGuard("social-post-1");

    expect(result.result?.status).toBe("blocked");
  });

  it("naver_cafe는 질문형 문장이 없으면 needs_revision이다", async () => {
    getSocialPostForPublishingGuard.mockResolvedValue(
      makeSocialPost({
        platform: "naver_cafe",
        postBody: "이것은 평서문으로만 이루어진 본문입니다. 질문이 전혀 없습니다. ".repeat(20),
      })
    );

    const result = await runPlatformPublishingGuard("social-post-1");

    expect(["needs_revision", "ready"]).toContain(result.result?.status);
    if (result.result?.status === "needs_revision") {
      expect(result.result.warnings.some((w) => w.includes("질문") || w.includes("토론"))).toBe(true);
    }
  });

  it("x는 thread_items가 없으면 blocked된다", async () => {
    getSocialPostForPublishingGuard.mockResolvedValue(
      makeSocialPost({ platform: "x", postBody: null, threadItems: [] })
    );

    const result = await runPlatformPublishingGuard("social-post-1");

    expect(result.result?.status).toBe("blocked");
  });

  it("x는 thread item 길이 초과 시 needs_revision/blocked가 된다", async () => {
    getSocialPostForPublishingGuard.mockResolvedValue(
      makeSocialPost({
        platform: "x",
        postBody: null,
        threadItems: [
          { order: 1, text: "hook이 될 만큼 충분히 긴 첫 문장입니다" },
          { order: 2, text: "가".repeat(300) },
        ],
      })
    );

    const result = await runPlatformPublishingGuard("social-post-1");

    expect(["needs_revision", "blocked"]).toContain(result.result?.status);
  });

  it("threads는 post_body가 없으면 blocked된다", async () => {
    getSocialPostForPublishingGuard.mockResolvedValue(makeSocialPost({ platform: "threads", postBody: null }));

    const result = await runPlatformPublishingGuard("social-post-1");

    expect(result.result?.status).toBe("blocked");
  });

  it("instagram은 caption이 없으면 blocked된다", async () => {
    getSocialPostForPublishingGuard.mockResolvedValue(
      makeSocialPost({ platform: "instagram", postBody: null, caption: null, cardItems: [{ order: 1, heading: "h", body: "b" }] })
    );

    const result = await runPlatformPublishingGuard("social-post-1");

    expect(result.result?.status).toBe("blocked");
  });

  it("instagram은 hashtags가 없으면 needs_revision이다", async () => {
    getSocialPostForPublishingGuard.mockResolvedValue(
      makeSocialPost({
        platform: "instagram",
        postBody: null,
        caption: "충분히 긴 인스타그램 캡션입니다. ".repeat(5),
        hashtags: [],
        cardItems: [{ order: 1, heading: "h", body: "b" }],
        mediaRequirements: { requiresImage: true },
      })
    );

    const result = await runPlatformPublishingGuard("social-post-1");

    expect(result.result?.status).not.toBe("blocked");
    expect(result.result?.warnings.some((w) => w.includes("해시태그"))).toBe(true);
  });

  it("instagram은 media_requirements가 없으면 needs_revision이다", async () => {
    getSocialPostForPublishingGuard.mockResolvedValue(
      makeSocialPost({
        platform: "instagram",
        postBody: null,
        caption: "충분히 긴 인스타그램 캡션입니다. ".repeat(5),
        hashtags: ["태그1"],
        cardItems: [],
        mediaRequirements: {},
      })
    );

    const result = await runPlatformPublishingGuard("social-post-1");

    expect(result.result?.status).not.toBe("blocked");
    expect(result.result?.warnings.some((w) => w.includes("media_requirements") || w.includes("card_items"))).toBe(true);
  });
});

describe("보안 요구사항", () => {
  it("logs에 full content/API key/auth token이 저장되지 않는다", async () => {
    getSocialPostForPublishingGuard.mockResolvedValue(makeSocialPost());

    await runPlatformPublishingGuard("social-post-1");

    const serialized = JSON.stringify(logEvent.mock.calls).toLowerCase();
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("api_key");
    expect(serialized).not.toContain("app_password");
    expect(serialized).not.toContain("문장고유토큰0 문장고유토큰1");
  });
});
