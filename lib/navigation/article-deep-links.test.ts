import { describe, expect, it } from "vitest";
import {
  buildArticleOverviewUrl,
  buildArticleBlogUrl,
  buildArticleSocialUrl,
  buildArticleRewriteUrl,
  buildArticlePerformanceUrl,
  buildSocialPostDeepLink,
  buildRewriteSuggestionDeepLink,
  buildRewriteVersionDeepLink,
  buildMetricsDeepLink,
  buildComparisonDeepLink,
} from "./article-deep-links";

describe("buildArticle*Url", () => {
  it("옵션 없이 기본 경로를 만든다", () => {
    expect(buildArticleOverviewUrl("a1")).toBe("/articles/a1");
    expect(buildArticleBlogUrl("a1")).toBe("/articles/a1/blog");
    expect(buildArticleSocialUrl("a1")).toBe("/articles/a1/social");
    expect(buildArticleRewriteUrl("a1")).toBe("/articles/a1/rewrite");
    expect(buildArticlePerformanceUrl("a1")).toBe("/articles/a1/performance");
  });

  it("returnTo가 안전하지 않으면 query에 포함하지 않는다", () => {
    expect(buildArticleBlogUrl("a1", { returnTo: "https://evil.com" })).toBe("/articles/a1/blog");
  });

  it("returnTo가 안전하면 query에 포함한다", () => {
    expect(buildArticleBlogUrl("a1", { returnTo: "/articles/a1" })).toBe("/articles/a1/blog?returnTo=%2Farticles%2Fa1");
  });
});

describe("buildSocialPostDeepLink", () => {
  it("wordpress_blog는 /blog URL을 만든다", () => {
    expect(buildSocialPostDeepLink("a1", "wordpress_blog", "p1")).toBe("/articles/a1/blog?socialPostId=p1&highlight=p1");
  });

  it("naver_blog는 /blog URL을 만든다", () => {
    expect(buildSocialPostDeepLink("a1", "naver_blog", "p1")).toBe("/articles/a1/blog?socialPostId=p1&highlight=p1");
  });

  it("naver_cafe는 /social URL을 만든다", () => {
    expect(buildSocialPostDeepLink("a1", "naver_cafe", "p1")).toBe("/articles/a1/social?socialPostId=p1&highlight=p1");
  });

  it("x는 /social URL을 만든다", () => {
    expect(buildSocialPostDeepLink("a1", "x", "p1")).toBe("/articles/a1/social?socialPostId=p1&highlight=p1");
  });

  it("threads는 /social URL을 만든다", () => {
    expect(buildSocialPostDeepLink("a1", "threads", "p1")).toBe("/articles/a1/social?socialPostId=p1&highlight=p1");
  });

  it("instagram은 /social URL을 만든다", () => {
    expect(buildSocialPostDeepLink("a1", "instagram", "p1")).toBe("/articles/a1/social?socialPostId=p1&highlight=p1");
  });

  it("returnTo가 안전하면 query에 포함된다", () => {
    expect(buildSocialPostDeepLink("a1", "wordpress_blog", "p1", "/articles/a1")).toBe(
      "/articles/a1/blog?socialPostId=p1&highlight=p1&returnTo=%2Farticles%2Fa1"
    );
  });

  it("returnTo가 안전하지 않으면 무시된다", () => {
    expect(buildSocialPostDeepLink("a1", "wordpress_blog", "p1", "https://evil.com")).toBe("/articles/a1/blog?socialPostId=p1&highlight=p1");
  });
});

describe("나머지 deep link helper", () => {
  it("buildRewriteSuggestionDeepLink는 /rewrite URL을 만든다", () => {
    expect(buildRewriteSuggestionDeepLink("a1", "s1")).toBe("/articles/a1/rewrite?rewriteSuggestionId=s1&highlight=s1");
  });

  it("buildRewriteVersionDeepLink는 /rewrite URL을 만든다", () => {
    expect(buildRewriteVersionDeepLink("a1", "v1")).toBe("/articles/a1/rewrite?rewriteVersionId=v1&highlight=v1");
  });

  it("buildMetricsDeepLink는 /performance URL을 만든다", () => {
    expect(buildMetricsDeepLink("a1", "p1")).toBe("/articles/a1/performance?socialPostId=p1&metricsTargetId=p1&highlight=p1");
  });

  it("buildComparisonDeepLink는 /performance URL을 만든다", () => {
    expect(buildComparisonDeepLink("a1", "c1")).toBe("/articles/a1/performance?comparisonId=c1&highlight=c1");
  });
});
