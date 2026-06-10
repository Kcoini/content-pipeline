import { describe, expect, it } from "vitest";
import { mapSourceRowToSource } from "./source-repository";
import type { SourceRow } from "@/lib/supabase/database.types";

function makeSourceRow(overrides: Partial<SourceRow> = {}): SourceRow {
  return {
    id: "source-1",
    theme_id: "theme-1",
    url: "https://a.example.com",
    title: "출처 A",
    author: "A 매체",
    published_at: "2026-01-15T00:00:00.000Z",
    summary: "요약",
    metadata: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("mapSourceRowToSource", () => {
  it("sources row를 Source로 변환하고 published_at을 YYYY-MM-DD로 자른다", () => {
    const source = mapSourceRowToSource(makeSourceRow());

    expect(source).toEqual({
      id: "source-1",
      themeId: "theme-1",
      url: "https://a.example.com",
      title: "출처 A",
      publisher: "A 매체",
      publishedAt: "2026-01-15",
      summary: "요약",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("author/published_at/summary가 null이면 빈 문자열로 변환한다", () => {
    const source = mapSourceRowToSource(
      makeSourceRow({ author: null, published_at: null, summary: null })
    );

    expect(source.publisher).toBe("");
    expect(source.publishedAt).toBe("");
    expect(source.summary).toBe("");
  });
});
