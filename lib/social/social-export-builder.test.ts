import { describe, expect, it } from "vitest";
import { buildExportPayload } from "./social-export-builder";
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
    publishStatus: "not_published",
    externalPostId: null,
    postUrl: null,
    exportFormat: null,
    exportPayload: {},
    errorMessage: null,
    generatedAt: "2026-01-01T00:00:00.000Z",
    reviewedAt: null,
    publishedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildExportPayload", () => {
  it("naver_cafe는 plain text export가 가능하다", () => {
    const post = makeSocialPost({ platform: "naver_cafe", postTitle: "질문 있습니다", postBody: "본문" });

    const result = buildExportPayload(post);

    expect(result.format).toBe("plain_text_copy");
    expect(typeof result.payload.text).toBe("string");
    expect(result.payload.text).toContain("질문 있습니다");
    expect(result.payload.text).toContain("본문");
  });

  it("x는 thread_items 구조를 지원한다", () => {
    const post = makeSocialPost({
      platform: "x",
      postBody: null,
      threadItems: [
        { order: 1, text: "첫 트윗" },
        { order: 2, text: "두번째 트윗" },
      ],
    });

    const result = buildExportPayload(post);

    expect(result.format).toBe("thread_json");
    expect(result.payload.items).toEqual([
      { order: 1, text: "첫 트윗" },
      { order: 2, text: "두번째 트윗" },
    ]);
  });

  it("instagram은 caption/card_items 구조를 지원한다", () => {
    const post = makeSocialPost({
      platform: "instagram",
      postBody: null,
      caption: "인스타 캡션입니다",
      cardItems: [{ order: 1, heading: "카드1", body: "카드 본문1" }],
    });

    const result = buildExportPayload(post);

    expect(result.format).toBe("caption_and_card_items");
    expect(result.payload.caption).toBe("인스타 캡션입니다");
    expect(result.payload.cardItems).toEqual([{ order: 1, heading: "카드1", body: "카드 본문1" }]);
  });

  it("wordpress_blog는 html_or_markdown 형식을 반환한다", () => {
    const post = makeSocialPost({ platform: "wordpress_blog" });

    const result = buildExportPayload(post);

    expect(result.format).toBe("html_or_markdown");
    expect(result.payload.title).toBe("제목");
  });

  it("threads는 plain text 형식을 반환한다", () => {
    const post = makeSocialPost({ platform: "threads", postTitle: null, postBody: "쓰레드 본문" });

    const result = buildExportPayload(post);

    expect(result.format).toBe("plain_text_copy");
    expect(result.payload.text).toContain("쓰레드 본문");
  });
});
