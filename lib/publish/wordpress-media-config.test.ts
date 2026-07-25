import { afterEach, describe, expect, it, vi } from "vitest";
import { isWordPressMediaUploadEnabled, getAllowedMimeTypes, getMaxUploadSizeMb, getDefaultImageFilename } from "./wordpress-media-config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isWordPressMediaUploadEnabled", () => {
  it("기본값(미설정)은 false이다", () => {
    vi.stubEnv("WORDPRESS_MEDIA_UPLOAD_ENABLED", "");
    expect(isWordPressMediaUploadEnabled()).toBe(false);
  });

  it("true로 설정하면 true를 반환한다", () => {
    vi.stubEnv("WORDPRESS_MEDIA_UPLOAD_ENABLED", "true");
    expect(isWordPressMediaUploadEnabled()).toBe(true);
  });
});

describe("getAllowedMimeTypes", () => {
  it("jpeg/png/webp를 포함한다", () => {
    const types = getAllowedMimeTypes();
    expect(types).toContain("image/jpeg");
    expect(types).toContain("image/png");
    expect(types).toContain("image/webp");
  });
});

describe("getMaxUploadSizeMb", () => {
  it("기본값은 5MB이다", () => {
    vi.stubEnv("WORDPRESS_MEDIA_MAX_SIZE_MB", "");
    expect(getMaxUploadSizeMb()).toBe(5);
  });

  it("환경변수로 재정의할 수 있다", () => {
    vi.stubEnv("WORDPRESS_MEDIA_MAX_SIZE_MB", "10");
    expect(getMaxUploadSizeMb()).toBe(10);
  });
});

describe("getDefaultImageFilename", () => {
  it("slug 기반으로 파일명을 생성한다", () => {
    const filename = getDefaultImageFilename({ slug: "long-term-care-guide", id: "article-1" });
    expect(filename).toBe("long-term-care-guide-featured.webp");
  });

  it("slug가 없으면 article id 기반 fallback을 사용한다", () => {
    const filename = getDefaultImageFilename({ slug: null, id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" });
    expect(filename).toBe("article-a1b2c3d4-featured.webp");
  });

  it("한글 slug는 파일명에서 제거된다 (ASCII 안전 문자열)", () => {
    const filename = getDefaultImageFilename({ slug: "요양원-요양병원-차이", id: "article-1" });
    expect(filename).toMatch(/^article-[a-z0-9]+-featured\.webp$/);
  });

  it("확장자를 지정하면 그 확장자를 사용한다", () => {
    const filename = getDefaultImageFilename({ slug: "care-guide", id: "article-1" }, "jpg");
    expect(filename).toBe("care-guide-featured.jpg");
  });

  it("허용되지 않는 확장자면 기본값(webp)으로 대체한다", () => {
    const filename = getDefaultImageFilename({ slug: "care-guide", id: "article-1" }, "exe");
    expect(filename).toBe("care-guide-featured.webp");
  });

  it("파일명은 80자를 넘지 않는다", () => {
    const longSlug = "a".repeat(100);
    const filename = getDefaultImageFilename({ slug: longSlug, id: "article-1" });
    expect(filename.length).toBeLessThanOrEqual(80);
  });
});
