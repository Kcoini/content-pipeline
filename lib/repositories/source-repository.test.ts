import { describe, expect, it } from "vitest";
import { mapSourceRowToSource, DuplicateSourceError } from "./source-repository";
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
    fetch_status: "pending",
    raw_content: null,
    extracted_title: null,
    fetched_at: null,
    fetch_error: null,
    ...overrides,
  };
}

describe("DuplicateSourceError", () => {
  it("Error를 상속하고 name이 DuplicateSourceError이다", () => {
    const err = new DuplicateSourceError("https://example.com");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("DuplicateSourceError");
  });

  it("사용자 친화적 메시지를 포함한다", () => {
    const err = new DuplicateSourceError("https://example.com");
    expect(err.message).toContain("이미 이 테마에 등록된 출처입니다");
    expect(err.message).toContain("https://example.com");
  });

  it("instanceof DuplicateSourceError로 catch할 수 있다", () => {
    const fn = () => { throw new DuplicateSourceError("https://a.com"); };
    expect(() => fn()).toThrow(DuplicateSourceError);
  });

  it("23505 이외의 오류는 DuplicateSourceError가 아니다", () => {
    const err = new Error("other error");
    expect(err).not.toBeInstanceOf(DuplicateSourceError);
  });
});

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
      fetchStatus: "pending",
      fetchError: null,
      rawContent: null,
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

  it("fetch_status=success이면 fetchStatus가 success로 변환된다", () => {
    const source = mapSourceRowToSource(
      makeSourceRow({
        fetch_status: "success",
        raw_content: "본문 내용",
        extracted_title: "추출된 제목",
        fetched_at: "2026-01-01T12:00:00.000Z",
        fetch_error: null,
      })
    );

    expect(source.fetchStatus).toBe("success");
    expect(source.rawContent).toBe("본문 내용");
    expect(source.fetchError).toBeNull();
  });

  it("fetch_status=failed이면 fetchError가 전달된다", () => {
    const source = mapSourceRowToSource(
      makeSourceRow({
        fetch_status: "failed",
        fetch_error: "HTTP 404 Not Found",
      })
    );

    expect(source.fetchStatus).toBe("failed");
    expect(source.fetchError).toBe("HTTP 404 Not Found");
  });
});
