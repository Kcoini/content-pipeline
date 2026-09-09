import { describe, expect, it } from "vitest";
import {
  ARTICLE_MODE_CONFIGS,
  ARTICLE_MODE_LIST,
  DEFAULT_ARTICLE_MODE,
  isArticleMode,
  resolveArticleMode,
  AUTO_MASTER_MANUSCRIPT_DIRECTION,
  MASTER_MANUSCRIPT_DIRECTION_LIST,
  getMasterManuscriptDirectionLabel,
  resolveMasterManuscriptDirection,
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

describe("마스터 원고 생성 방향 (Phase 4-1)", () => {
  it("자동 추천 + 기존 3종류로 4개 선택지를 구성한다", () => {
    expect(MASTER_MANUSCRIPT_DIRECTION_LIST).toHaveLength(4);
    expect(MASTER_MANUSCRIPT_DIRECTION_LIST[0]).toBe(AUTO_MASTER_MANUSCRIPT_DIRECTION);
    expect(MASTER_MANUSCRIPT_DIRECTION_LIST.slice(1).sort()).toEqual(
      ["general_news", "monetized_blog", "source_based_explainer"].sort()
    );
  });

  it("각 방향에 사용자 친화적 라벨이 있다(기존 ArticleModeConfig.label과는 분리된 표현)", () => {
    expect(getMasterManuscriptDirectionLabel("auto")).toBe("자동 추천");
    expect(getMasterManuscriptDirectionLabel("general_news")).toBe("빠른 기사 중심");
    expect(getMasterManuscriptDirectionLabel("source_based_explainer")).toBe("해설 중심");
    expect(getMasterManuscriptDirectionLabel("monetized_blog")).toBe("SEO/수익화 중심");
  });

  it("resolveMasterManuscriptDirection은 auto를 기본 ArticleMode로 바꾼다", () => {
    expect(resolveMasterManuscriptDirection("auto")).toBe(DEFAULT_ARTICLE_MODE);
  });

  it("resolveMasterManuscriptDirection은 유효한 기존 모드는 그대로 반환한다", () => {
    expect(resolveMasterManuscriptDirection("general_news")).toBe("general_news");
    expect(resolveMasterManuscriptDirection("monetized_blog")).toBe("monetized_blog");
  });

  it("resolveMasterManuscriptDirection은 알 수 없는 값이면 기본값으로 대체한다(resolveArticleMode에 위임)", () => {
    expect(resolveMasterManuscriptDirection("not_a_mode")).toBe(DEFAULT_ARTICLE_MODE);
    expect(resolveMasterManuscriptDirection(undefined)).toBe(DEFAULT_ARTICLE_MODE);
  });

  it("기존 ArticleMode enum과 3종류 목록은 그대로 남아 있다(삭제되지 않음)", () => {
    expect(isArticleMode("general_news")).toBe(true);
    expect(isArticleMode("source_based_explainer")).toBe(true);
    expect(isArticleMode("monetized_blog")).toBe(true);
    expect(ARTICLE_MODE_LIST).toHaveLength(3);
  });
});
