import { describe, expect, it } from "vitest";
import { buildWordPressBlogPostPreview, BODY_PREVIEW_LENGTH, type WordPressBlogPreviewInput } from "./wordpress-blog-post-preview-builder";

function makeInput(overrides: Partial<WordPressBlogPreviewInput> = {}): WordPressBlogPreviewInput {
  return {
    postTitle: "WordPress 블로그 제목",
    postBody: "본문 내용입니다.",
    seoTitle: "SEO 제목",
    metaDescription: "메타 설명",
    targetKeyword: "키워드",
    featuredImageUrl: "https://example.com/image.jpg",
    ...overrides,
  };
}

describe("buildWordPressBlogPostPreview", () => {
  it("wordpress_blog 자신의 제목/SEO metadata/대표 이미지를 그대로 반환한다", () => {
    const preview = buildWordPressBlogPostPreview(makeInput());
    expect(preview.title).toBe("WordPress 블로그 제목");
    expect(preview.seoTitle).toBe("SEO 제목");
    expect(preview.metaDescription).toBe("메타 설명");
    expect(preview.targetKeyword).toBe("키워드");
    expect(preview.featuredImageUrl).toBe("https://example.com/image.jpg");
  });

  it("제목이 없으면 안내 문구를 대신 표시한다", () => {
    const preview = buildWordPressBlogPostPreview(makeInput({ postTitle: null }));
    expect(preview.title).toContain("제목 없음");
  });

  it("본문이 BODY_PREVIEW_LENGTH 이하면 잘리지 않는다", () => {
    const body = "짧은 본문";
    const preview = buildWordPressBlogPostPreview(makeInput({ postBody: body }));
    expect(preview.bodyTruncated).toBe(false);
    expect(preview.bodyPreviewText).toBe(body);
    expect(preview.bodyFullLength).toBe(body.length);
  });

  it("본문이 BODY_PREVIEW_LENGTH를 초과하면 잘라서 보여주고 truncated=true다", () => {
    const body = "가".repeat(BODY_PREVIEW_LENGTH + 200);
    const preview = buildWordPressBlogPostPreview(makeInput({ postBody: body }));
    expect(preview.bodyTruncated).toBe(true);
    expect(preview.bodyPreviewText.length).toBe(BODY_PREVIEW_LENGTH);
    expect(preview.bodyFullLength).toBe(body.length);
  });

  it("본문에 AD_SLOT marker가 있으면 한국어 라벨과 함께 추출한다", () => {
    const body = [
      "도입부",
      "<!-- AD_SLOT: after_summary -->",
      "본문",
      "<!-- AD_SLOT: before_faq -->",
      "FAQ",
    ].join("\n");
    const preview = buildWordPressBlogPostPreview(makeInput({ postBody: body }));
    expect(preview.adSlotMarkers).toEqual([
      { marker: "after_summary", label: "요약 아래" },
      { marker: "before_faq", label: "FAQ 앞" },
    ]);
  });

  it("본문에 AD_SLOT marker가 없으면 빈 배열을 반환한다", () => {
    const preview = buildWordPressBlogPostPreview(makeInput({ postBody: "AD_SLOT 없는 본문" }));
    expect(preview.adSlotMarkers).toEqual([]);
  });

  it("본문에 FAQ heading이 있으면 그 아래 텍스트를 추출한다", () => {
    const body = ["## 본문", "본문 내용", "## FAQ", "Q1. 질문입니다", "A1. 답변입니다", "## 결론", "결론 내용"].join("\n");
    const preview = buildWordPressBlogPostPreview(makeInput({ postBody: body }));
    expect(preview.faqPreviewText).toContain("Q1. 질문입니다");
    expect(preview.faqPreviewText).not.toContain("결론 내용");
  });

  it("본문에 FAQ heading이 없으면 null을 반환한다", () => {
    const preview = buildWordPressBlogPostPreview(makeInput({ postBody: "FAQ 없는 본문" }));
    expect(preview.faqPreviewText).toBeNull();
  });

  it("본문에 참고자료/출처 heading이 있으면 그 아래 텍스트를 추출한다", () => {
    const body = ["## 본문", "본문 내용", "## 참고자료", "- 출처 1", "- 출처 2"].join("\n");
    const preview = buildWordPressBlogPostPreview(makeInput({ postBody: body }));
    expect(preview.sourcesPreviewText).toContain("출처 1");
  });

  it("참고자료/출처 heading이 없으면 null을 반환한다", () => {
    const preview = buildWordPressBlogPostPreview(makeInput({ postBody: "참고자료 없는 본문" }));
    expect(preview.sourcesPreviewText).toBeNull();
  });

  it("postBody가 null이어도 오류 없이 빈 미리보기를 반환한다", () => {
    const preview = buildWordPressBlogPostPreview(makeInput({ postBody: null }));
    expect(preview.bodyPreviewText).toBe("");
    expect(preview.bodyFullLength).toBe(0);
    expect(preview.adSlotMarkers).toEqual([]);
  });
});
