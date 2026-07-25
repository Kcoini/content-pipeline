import { describe, expect, it } from "vitest";
import {
  ArticleNotEditableError,
  EmptyContentError,
  assertArticleApprovable,
  assertArticleEditable,
  mapArticleRowToArticle,
} from "./article-repository";
import type { ArticleRow } from "@/lib/supabase/database.types";

function makeArticleRow(overrides: Partial<ArticleRow> = {}): ArticleRow {
  return {
    id: "article-1",
    theme_id: "theme-1",
    title: "AI 에이전트 동향",
    content: "본문".repeat(300),
    status: "draft",
    version: 1,
    reviewed_at: null,
    reviewed_by: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    article_mode: "source_based_explainer",
    seo_title: null,
    meta_description: null,
    slug: null,
    target_keyword: null,
    secondary_keywords: [],
    search_intent: null,
    reader_persona: null,
    ad_slots: [],
    internal_link_suggestions: [],
    monetization_score: null,
    policy_risk_score: null,
    format_metadata: {},
    wp_category_names: [],
    wp_tag_names: [],
    wp_category_ids: [],
    wp_tag_ids: [],
    wp_metadata_status: "not_ready",
    wp_metadata_generated_at: null,
    ...overrides,
  };
}

describe("mapArticleRowToArticle", () => {
  it("articles row와 인용 출처 id 목록을 Article로 변환한다", () => {
    const row = makeArticleRow();
    const article = mapArticleRowToArticle(row, ["source-1", "source-2", "source-3"]);

    expect(article).toEqual({
      id: "article-1",
      themeId: "theme-1",
      title: "AI 에이전트 동향",
      content: row.content,
      status: "draft",
      citedSourceIds: ["source-1", "source-2", "source-3"],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      reviewedAt: null,
      reviewedBy: null,
      articleMode: "source_based_explainer",
      seoTitle: null,
      metaDescription: null,
      slug: null,
      targetKeyword: null,
      secondaryKeywords: [],
      searchIntent: null,
      readerPersona: null,
      adSlots: [],
      internalLinkSuggestions: [],
      monetizationScore: null,
      policyRiskScore: null,
      formatMetadata: {},
      wpCategoryNames: [],
      wpTagNames: [],
      wpCategoryIds: [],
      wpTagIds: [],
      wpMetadataStatus: "not_ready",
      wpMetadataGeneratedAt: null,
    });
  });

  it("reviewed 기사는 reviewedAt/reviewedBy를 포함한다", () => {
    const row = makeArticleRow({
      status: "reviewed",
      reviewed_at: "2026-01-02T00:00:00.000Z",
      reviewed_by: "local-user",
    });
    const article = mapArticleRowToArticle(row, []);

    expect(article.status).toBe("reviewed");
    expect(article.reviewedAt).toBe("2026-01-02T00:00:00.000Z");
    expect(article.reviewedBy).toBe("local-user");
  });
});

describe("assertArticleEditable", () => {
  it("draft 상태인 기사는 수정 가능하다 (예외를 던지지 않는다)", () => {
    expect(() => assertArticleEditable({ id: "article-1", status: "draft" })).not.toThrow();
  });

  it("reviewed 상태인 기사는 수정할 수 없다", () => {
    expect(() => assertArticleEditable({ id: "article-1", status: "reviewed" })).toThrow(
      ArticleNotEditableError
    );
  });

  it("published 상태인 기사는 수정할 수 없다", () => {
    expect(() => assertArticleEditable({ id: "article-1", status: "published" })).toThrow(
      ArticleNotEditableError
    );
  });
});

describe("assertArticleApprovable", () => {
  it("본문이 있으면 승인 가능하다 (예외를 던지지 않는다)", () => {
    expect(() =>
      assertArticleApprovable({ id: "article-1", content: "본문 내용".repeat(100) })
    ).not.toThrow();
  });

  it("본문이 비어 있으면 승인할 수 없다", () => {
    expect(() => assertArticleApprovable({ id: "article-1", content: "" })).toThrow(
      EmptyContentError
    );
  });

  it("본문이 공백뿐이면 승인할 수 없다", () => {
    expect(() => assertArticleApprovable({ id: "article-1", content: "   \n  " })).toThrow(
      EmptyContentError
    );
  });
});
