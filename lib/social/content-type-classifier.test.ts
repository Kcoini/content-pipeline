import { describe, expect, it } from "vitest";
import {
  classifyContentGroup,
  classifyContentType,
  getContentGroupLabel,
  getContentTypeLabel,
  getContentGroupBadge,
  getPlatformDisplayLabel,
  getPlatformGroup,
} from "./content-type-classifier";
import { SOCIAL_PLATFORMS } from "./social-platform-types";

describe("getPlatformGroup", () => {
  it("wordpress_blog/naver_blog는 blog다", () => {
    expect(getPlatformGroup("wordpress_blog")).toBe("blog");
    expect(getPlatformGroup("naver_blog")).toBe("blog");
  });

  it("naver_cafe는 community다", () => {
    expect(getPlatformGroup("naver_cafe")).toBe("community");
  });

  it("x/threads/instagram은 social이다", () => {
    expect(getPlatformGroup("x")).toBe("social");
    expect(getPlatformGroup("threads")).toBe("social");
    expect(getPlatformGroup("instagram")).toBe("social");
  });
});

describe("classifyContentGroup", () => {
  it("article은 original_article이다", () => {
    expect(classifyContentGroup({ kind: "article" })).toBe("original_article");
  });

  it("metrics/rewrite_comparison은 performance다", () => {
    expect(classifyContentGroup({ kind: "metrics" })).toBe("performance");
    expect(classifyContentGroup({ kind: "rewrite_comparison" })).toBe("performance");
  });

  it("wordpress_blog(non-rewrite)는 blog로 분류된다", () => {
    expect(classifyContentGroup({ kind: "social_post", platform: "wordpress_blog", isRewriteVersion: false })).toBe("blog");
  });

  it("naver_blog(non-rewrite)는 blog로 분류된다", () => {
    expect(classifyContentGroup({ kind: "social_post", platform: "naver_blog", isRewriteVersion: false })).toBe("blog");
  });

  it("naver_cafe(non-rewrite)는 community로 분류된다", () => {
    expect(classifyContentGroup({ kind: "social_post", platform: "naver_cafe", isRewriteVersion: false })).toBe("community");
  });

  it("x(non-rewrite)는 social로 분류된다", () => {
    expect(classifyContentGroup({ kind: "social_post", platform: "x", isRewriteVersion: false })).toBe("social");
  });

  it("threads(non-rewrite)는 social로 분류된다", () => {
    expect(classifyContentGroup({ kind: "social_post", platform: "threads", isRewriteVersion: false })).toBe("social");
  });

  it("instagram(non-rewrite)는 social로 분류된다", () => {
    expect(classifyContentGroup({ kind: "social_post", platform: "instagram", isRewriteVersion: false })).toBe("social");
  });

  it("is_rewrite_version=true이면 platform과 무관하게 rewrite로 분류된다", () => {
    for (const platform of SOCIAL_PLATFORMS) {
      expect(classifyContentGroup({ kind: "social_post", platform, isRewriteVersion: true })).toBe("rewrite");
    }
  });
});

describe("classifyContentType", () => {
  it("rewrite version은 원래 platform에 따라 rewrite_blog/rewrite_social/rewrite_community로 구분된다", () => {
    expect(classifyContentType({ kind: "social_post", platform: "wordpress_blog", isRewriteVersion: true })).toBe("rewrite_blog");
    expect(classifyContentType({ kind: "social_post", platform: "naver_blog", isRewriteVersion: true })).toBe("rewrite_blog");
    expect(classifyContentType({ kind: "social_post", platform: "naver_cafe", isRewriteVersion: true })).toBe("rewrite_community");
    expect(classifyContentType({ kind: "social_post", platform: "x", isRewriteVersion: true })).toBe("rewrite_social");
    expect(classifyContentType({ kind: "social_post", platform: "threads", isRewriteVersion: true })).toBe("rewrite_social");
    expect(classifyContentType({ kind: "social_post", platform: "instagram", isRewriteVersion: true })).toBe("rewrite_social");
  });

  it("non-rewrite social post는 platform별 세부 타입으로 분류된다", () => {
    expect(classifyContentType({ kind: "social_post", platform: "wordpress_blog", isRewriteVersion: false })).toBe("wordpress_blog");
    expect(classifyContentType({ kind: "social_post", platform: "naver_blog", isRewriteVersion: false })).toBe("naver_blog");
    expect(classifyContentType({ kind: "social_post", platform: "naver_cafe", isRewriteVersion: false })).toBe("naver_cafe");
    expect(classifyContentType({ kind: "social_post", platform: "x", isRewriteVersion: false })).toBe("x_thread");
    expect(classifyContentType({ kind: "social_post", platform: "threads", isRewriteVersion: false })).toBe("threads_post");
    expect(classifyContentType({ kind: "social_post", platform: "instagram", isRewriteVersion: false })).toBe("instagram_caption");
  });

  it("article/metrics/rewrite_comparison은 각각 고유 type을 반환한다", () => {
    expect(classifyContentType({ kind: "article" })).toBe("article");
    expect(classifyContentType({ kind: "metrics" })).toBe("metrics");
    expect(classifyContentType({ kind: "rewrite_comparison" })).toBe("rewrite_comparison");
  });
});

describe("label/badge/platform helpers", () => {
  it("getContentGroupLabel이 한국어 라벨을 반환한다", () => {
    expect(getContentGroupLabel("original_article")).toBe("원본 기사");
    expect(getContentGroupLabel("blog")).toBe("블로그 글");
    expect(getContentGroupLabel("community")).toBe("커뮤니티 글");
    expect(getContentGroupLabel("social")).toBe("SNS 글");
    expect(getContentGroupLabel("rewrite")).toBe("개선 버전");
    expect(getContentGroupLabel("performance")).toBe("성과");
    expect(getContentGroupLabel("unknown")).toBe("미분류");
  });

  it("getContentTypeLabel이 모든 content type에 대해 라벨을 반환한다", () => {
    expect(getContentTypeLabel("wordpress_blog")).toBeTruthy();
    expect(getContentTypeLabel("rewrite_blog")).toBeTruthy();
  });

  it("getContentGroupBadge가 label과 className을 반환한다", () => {
    const badge = getContentGroupBadge("rewrite");
    expect(badge.label).toBe("개선 버전");
    expect(badge.className).toContain("indigo");
  });

  it("getPlatformDisplayLabel이 표시용 라벨을 반환한다", () => {
    expect(getPlatformDisplayLabel("wordpress_blog")).toBe("WordPress Blog");
    expect(getPlatformDisplayLabel("naver_blog")).toBe("Naver Blog");
    expect(getPlatformDisplayLabel("naver_cafe")).toBe("Naver Cafe");
    expect(getPlatformDisplayLabel("x")).toBe("X");
    expect(getPlatformDisplayLabel("threads")).toBe("Threads");
    expect(getPlatformDisplayLabel("instagram")).toBe("Instagram");
  });
});
