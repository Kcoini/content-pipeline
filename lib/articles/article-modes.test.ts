import { describe, expect, it } from "vitest";
import {
  ARTICLE_MODE_CONFIGS,
  ARTICLE_MODE_LIST,
  DEFAULT_ARTICLE_MODE,
  isArticleMode,
  resolveArticleMode,
} from "./article-modes";

describe("article-modes", () => {
  it("기본값은 source_based_explainer이다", () => {
    expect(DEFAULT_ARTICLE_MODE).toBe("source_based_explainer");
  });

  it("resolveArticleMode는 유효하지 않은 값이면 기본값으로 대체한다", () => {
    expect(resolveArticleMode(undefined)).toBe("source_based_explainer");
    expect(resolveArticleMode(null)).toBe("source_based_explainer");
    expect(resolveArticleMode("")).toBe("source_based_explainer");
    expect(resolveArticleMode("not_a_mode")).toBe("source_based_explainer");
  });

  it("resolveArticleMode는 유효한 값을 그대로 반환한다", () => {
    expect(resolveArticleMode("general_news")).toBe("general_news");
    expect(resolveArticleMode("monetized_blog")).toBe("monetized_blog");
  });

  it("isArticleMode는 3개 모드만 true를 반환한다", () => {
    expect(isArticleMode("general_news")).toBe(true);
    expect(isArticleMode("source_based_explainer")).toBe(true);
    expect(isArticleMode("monetized_blog")).toBe(true);
    expect(isArticleMode("published")).toBe(false);
  });

  it("ARTICLE_MODE_LIST는 3개 모드를 모두 포함한다", () => {
    expect(ARTICLE_MODE_LIST).toHaveLength(3);
    expect(ARTICLE_MODE_LIST.map((m) => m.id).sort()).toEqual(
      ["general_news", "monetized_blog", "source_based_explainer"].sort()
    );
  });

  it("monetized_blog는 SEO 메타데이터와 광고 슬롯이 필요하다", () => {
    expect(ARTICLE_MODE_CONFIGS.monetized_blog.requiresSeoMetadata).toBe(true);
    expect(ARTICLE_MODE_CONFIGS.monetized_blog.requiresAdSlots).toBe(true);
  });

  it("general_news는 SEO 메타데이터와 광고 슬롯이 필요하지 않다", () => {
    expect(ARTICLE_MODE_CONFIGS.general_news.requiresSeoMetadata).toBe(false);
    expect(ARTICLE_MODE_CONFIGS.general_news.requiresAdSlots).toBe(false);
  });
});
