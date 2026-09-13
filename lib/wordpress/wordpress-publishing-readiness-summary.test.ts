import { describe, expect, it } from "vitest";
import {
  summarizeWordPressPublishingReadiness,
  type WordPressPublishingReadinessInput,
} from "./wordpress-publishing-readiness-summary";

function baseInput(overrides: Partial<WordPressPublishingReadinessInput> = {}): WordPressPublishingReadinessInput {
  return {
    isReviewed: true,
    hasWordPressDraft: false,
    featuredImageUploadStatus: "not_ready",
    hasArticleFeaturedImage: false,
    featuredImageWaived: false,
    seoStatus: "not_ready",
    ...overrides,
  };
}

describe("summarizeWordPressPublishingReadiness", () => {
  it("승인 전이면 needs_review를 안내한다", () => {
    const result = summarizeWordPressPublishingReadiness(baseInput({ isReviewed: false }));
    expect(result.primaryAction).toBe("needs_review");
    expect(result.draftReadyLabel).toBe("승인 필요");
  });

  it("승인됐고 draft가 이미 있으면 view_draft를 안내한다", () => {
    const result = summarizeWordPressPublishingReadiness(baseInput({ hasWordPressDraft: true }));
    expect(result.primaryAction).toBe("view_draft");
    expect(result.connectionLabel).toBe("연결됨");
  });

  it("승인됐고 draft 없고 이미지도 준비 안 됐으면 prepare_image를 안내한다", () => {
    const result = summarizeWordPressPublishingReadiness(baseInput());
    expect(result.primaryAction).toBe("prepare_image");
    expect(result.imageLabel).toBe("준비 안 됨");
  });

  it("이미지가 업로드됐으면 create_draft를 안내한다", () => {
    const result = summarizeWordPressPublishingReadiness(baseInput({ featuredImageUploadStatus: "uploaded" }));
    expect(result.primaryAction).toBe("create_draft");
    expect(result.imageLabel).toBe("준비됨");
  });

  it("기존 media id가 지정되어 있으면 이미지가 준비된 것으로 본다", () => {
    const result = summarizeWordPressPublishingReadiness(baseInput({ hasArticleFeaturedImage: true }));
    expect(result.primaryAction).toBe("create_draft");
  });

  it("대표 이미지 없이 진행을 선택했으면 이미지가 준비된 것으로 본다", () => {
    const result = summarizeWordPressPublishingReadiness(baseInput({ featuredImageWaived: true }));
    expect(result.primaryAction).toBe("create_draft");
    expect(result.imageLabel).toBe("이미지 없이 진행");
  });

  it("SEO 상태를 짧은 사용자 라벨로 변환한다", () => {
    expect(summarizeWordPressPublishingReadiness(baseInput({ seoStatus: "confirmed" })).seoLabel).toBe("반영됨");
    expect(summarizeWordPressPublishingReadiness(baseInput({ seoStatus: "error" })).seoLabel).toBe("오류");
  });

  it("게시 상태는 항상 '자동 실행 안 함'이다(자동 public publish 방지)", () => {
    const result = summarizeWordPressPublishingReadiness(baseInput());
    expect(result.publishLabel).toBe("자동 실행 안 함");
  });
});
