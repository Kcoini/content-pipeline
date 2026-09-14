import { describe, expect, it } from "vitest";
import { getDefaultPostBodyViewMode, getPostBodyViewModeLabel } from "./post-body-view-mode";
import { SOCIAL_PLATFORMS } from "./social-platform-types";

describe("getDefaultPostBodyViewMode", () => {
  it("naver_cafe/x/threads/instagram은 copy가 기본이다(수동 복사 게시가 많은 플랫폼)", () => {
    expect(getDefaultPostBodyViewMode("naver_cafe")).toBe("copy");
    expect(getDefaultPostBodyViewMode("x")).toBe("copy");
    expect(getDefaultPostBodyViewMode("threads")).toBe("copy");
    expect(getDefaultPostBodyViewMode("instagram")).toBe("copy");
  });

  it("wordpress_blog/naver_blog/news_article/opinion_column은 preview가 기본이다(실제 게시 모습 확인이 우선)", () => {
    expect(getDefaultPostBodyViewMode("wordpress_blog")).toBe("preview");
    expect(getDefaultPostBodyViewMode("naver_blog")).toBe("preview");
    expect(getDefaultPostBodyViewMode("news_article")).toBe("preview");
    expect(getDefaultPostBodyViewMode("opinion_column")).toBe("preview");
  });

  it("모든 SocialPlatform에 대해 preview 또는 copy 중 하나를 반환한다(예외 없음)", () => {
    for (const platform of SOCIAL_PLATFORMS) {
      expect(["preview", "copy"]).toContain(getDefaultPostBodyViewMode(platform));
    }
  });
});

describe("getPostBodyViewModeLabel", () => {
  it("preview/source/copy에 대한 한글 라벨을 반환한다", () => {
    expect(getPostBodyViewModeLabel("preview")).toBe("게시용 미리보기");
    expect(getPostBodyViewModeLabel("source")).toBe("편집용 원문");
    expect(getPostBodyViewModeLabel("copy")).toBe("복사용 텍스트");
  });
});
