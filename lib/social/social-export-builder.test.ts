import { describe, expect, it } from "vitest";
import { buildExportPayload, buildManualExportPayload } from "./social-export-builder";
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

describe("buildManualExportPayload (Phase 3-5)", () => {
  it("wordpress_blog는 wordpress_markdown 형식으로 title/body를 반환한다", () => {
    const post = makeSocialPost({ platform: "wordpress_blog" });

    const result = buildManualExportPayload(post);

    expect(result.ok).toBe(true);
    expect(result.exportFormat).toBe("wordpress_markdown");
    expect(result.exportTitle).toBe("제목");
    expect(result.exportBody).toBe("본문 내용입니다.");
  });

  it("naver_blog는 title/body/hashtags를 분리해서 반환한다", () => {
    const post = makeSocialPost({ platform: "naver_blog" });

    const result = buildManualExportPayload(post);

    expect(result.ok).toBe(true);
    expect(result.exportFormat).toBe("naver_blog_markdown_copy");
    expect(result.exportHashtags).toEqual(["키워드1", "키워드2"]);
    expect(result.instructions?.length).toBeGreaterThan(0);
  });

  it("naver_cafe는 plain text export를 반환하고 홍보성 표현 안내를 포함한다", () => {
    const post = makeSocialPost({ platform: "naver_cafe" });

    const result = buildManualExportPayload(post);

    expect(result.ok).toBe(true);
    expect(result.exportFormat).toBe("naver_cafe_plain_text_copy");
    expect(result.instructions?.some((line) => line.includes("카페 규칙"))).toBe(true);
  });

  it("x는 thread_items 배열과 전체 복사용 text를 반환한다", () => {
    const post = makeSocialPost({
      platform: "x",
      postBody: null,
      threadItems: [
        { order: 1, text: "첫 트윗" },
        { order: 2, text: "두번째 트윗" },
      ],
    });

    const result = buildManualExportPayload(post);

    expect(result.ok).toBe(true);
    expect(result.exportThreadItems).toEqual(["첫 트윗", "두번째 트윗"]);
    expect(result.exportText).toContain("1/2");
  });

  it("x는 280자를 초과하는 thread item에 대해 warning을 반환한다", () => {
    const post = makeSocialPost({
      platform: "x",
      postBody: null,
      threadItems: [{ order: 1, text: "가".repeat(300) }],
    });

    const result = buildManualExportPayload(post);

    expect(result.ok).toBe(true);
    expect(result.warnings?.length).toBeGreaterThan(0);
  });

  it("threads는 post_body/hashtags를 반환한다", () => {
    const post = makeSocialPost({ platform: "threads", postTitle: null, postBody: "쓰레드 본문" });

    const result = buildManualExportPayload(post);

    expect(result.ok).toBe(true);
    expect(result.exportFormat).toBe("threads_plain_text_copy");
    expect(result.exportBody).toBe("쓰레드 본문");
  });

  it("instagram은 caption/hashtags/card_items를 반환한다", () => {
    const post = makeSocialPost({
      platform: "instagram",
      postBody: null,
      caption: "인스타 캡션",
      cardItems: [{ order: 1, heading: "카드1", body: "카드 본문1" }],
      mediaRequirements: { requiresImage: true },
    });

    const result = buildManualExportPayload(post);

    expect(result.ok).toBe(true);
    expect(result.exportFormat).toBe("instagram_caption_card_copy");
    expect(result.exportCaption).toBe("인스타 캡션");
    expect(result.exportCardItems).toEqual([{ order: 1, heading: "카드1", body: "카드 본문1" }]);
    expect(result.warnings).toBeUndefined();
  });

  it("instagram은 caption이 없으면 ok=false를 반환한다", () => {
    const post = makeSocialPost({ platform: "instagram", postBody: null, caption: null });

    const result = buildManualExportPayload(post);

    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("instagram은 media_requirements.requiresImage가 없으면 warning을 반환한다", () => {
    const post = makeSocialPost({ platform: "instagram", postBody: null, caption: "캡션", mediaRequirements: {} });

    const result = buildManualExportPayload(post);

    expect(result.ok).toBe(true);
    expect(result.warnings?.length).toBeGreaterThan(0);
  });
});
