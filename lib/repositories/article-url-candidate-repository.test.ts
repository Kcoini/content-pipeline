import { describe, expect, it } from "vitest";
import { mapCandidateRow } from "./article-url-candidate-repository";
import type { ArticleUrlCandidateRow } from "@/lib/supabase/database.types";

function makeRow(overrides: Partial<ArticleUrlCandidateRow> = {}): ArticleUrlCandidateRow {
  return {
    id: "cand-1",
    theme_id: "theme-1",
    theme_cluster_id: null,
    platform: "naver",
    query: "AI 에이전트",
    title: "AI 에이전트 급성장",
    snippet: "관련 시장이 빠르게 성장하고 있다.",
    url: "https://example.com/article-1",
    publisher: "한국경제",
    published_at: null,
    rank_position: 1,
    status: "candidate",
    metadata: { source: "mock" },
    collected_at: "2026-06-27T00:00:00.000Z",
    created_at: "2026-06-27T00:00:00.000Z",
    updated_at: "2026-06-27T00:00:00.000Z",
    ...overrides,
  };
}

describe("mapCandidateRow", () => {
  it("DB row를 ArticleUrlCandidate 도메인 타입으로 변환한다", () => {
    const candidate = mapCandidateRow(makeRow());

    expect(candidate.id).toBe("cand-1");
    expect(candidate.themeId).toBe("theme-1");
    expect(candidate.platform).toBe("naver");
    expect(candidate.query).toBe("AI 에이전트");
    expect(candidate.title).toBe("AI 에이전트 급성장");
    expect(candidate.url).toBe("https://example.com/article-1");
    expect(candidate.publisher).toBe("한국경제");
    expect(candidate.rankPosition).toBe(1);
    expect(candidate.status).toBe("candidate");
    expect(candidate.metadata).toEqual({ source: "mock" });
  });

  it("null 필드는 null로 유지된다", () => {
    const candidate = mapCandidateRow(makeRow({
      theme_cluster_id: null,
      query: null,
      title: null,
      snippet: null,
      publisher: null,
      published_at: null,
      rank_position: null,
    }));

    expect(candidate.themeClusterId).toBeNull();
    expect(candidate.query).toBeNull();
    expect(candidate.title).toBeNull();
    expect(candidate.snippet).toBeNull();
    expect(candidate.publisher).toBeNull();
    expect(candidate.publishedAt).toBeNull();
    expect(candidate.rankPosition).toBeNull();
  });

  it("imported 상태도 올바르게 변환된다", () => {
    const candidate = mapCandidateRow(makeRow({ status: "imported" }));
    expect(candidate.status).toBe("imported");
  });

  it("dismissed 상태도 올바르게 변환된다", () => {
    const candidate = mapCandidateRow(makeRow({ status: "dismissed" }));
    expect(candidate.status).toBe("dismissed");
  });
});
