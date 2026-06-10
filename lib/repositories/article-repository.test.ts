import { describe, expect, it } from "vitest";
import { mapArticleRowToArticle } from "./article-repository";
import type { ArticleRow } from "@/lib/supabase/database.types";

function makeArticleRow(overrides: Partial<ArticleRow> = {}): ArticleRow {
  return {
    id: "article-1",
    topic_id: "topic-1",
    title: "AI 에이전트 동향",
    content: "본문".repeat(300),
    status: "draft",
    version: 1,
    reviewed_at: null,
    reviewed_by: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("mapArticleRowToArticle", () => {
  it("articles row와 인용 출처 id 목록을 Article로 변환한다", () => {
    const row = makeArticleRow();
    const article = mapArticleRowToArticle(row, ["source-1", "source-2", "source-3"]);

    expect(article).toEqual({
      id: "article-1",
      themeId: "topic-1",
      title: "AI 에이전트 동향",
      content: row.content,
      status: "draft",
      citedSourceIds: ["source-1", "source-2", "source-3"],
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  });
});
