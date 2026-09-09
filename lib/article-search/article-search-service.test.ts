import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Theme } from "@/lib/types/domain";

const upsertArticleUrlCandidates = vi.fn();
const logEvent = vi.fn();
const isNaverKeySet = vi.fn();
const isDaumKeySet = vi.fn();
const searchNaverNews = vi.fn();
const searchDaumNews = vi.fn();

vi.mock("@/lib/repositories/article-url-candidate-repository", () => ({
  upsertArticleUrlCandidates: (...args: unknown[]) => upsertArticleUrlCandidates(...args),
  getArticleUrlCandidatesByThemeId: vi.fn(),
  updateArticleUrlCandidateStatus: vi.fn(),
}));

vi.mock("@/lib/repositories/log-repository", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

vi.mock("@/lib/trends/trend-service", () => ({
  isNaverKeySet: (...args: unknown[]) => isNaverKeySet(...args),
  isDaumKeySet: (...args: unknown[]) => isDaumKeySet(...args),
}));

vi.mock("@/lib/trends/naver-client", () => ({
  searchNaverNews: (...args: unknown[]) => searchNaverNews(...args),
}));

vi.mock("@/lib/trends/daum-client", () => ({
  searchDaumNews: (...args: unknown[]) => searchDaumNews(...args),
}));

// vi.mock은 호이스팅되므로 동적 import로 대상 모듈을 가져온다(위 mock들이 먼저 적용되게 하기 위함).
const { collectArticleUrlCandidates } = await import("./article-search-service");

function makeTheme(overrides: Partial<Theme> = {}): Theme {
  return {
    id: "theme-1",
    title: "AI 산업 동향",
    description: "",
    keywords: ["AI", "투자", "반도체"],
    language: "ko",
    status: "draft",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as Theme;
}

beforeEach(() => {
  vi.clearAllMocks();
  upsertArticleUrlCandidates.mockImplementation(async (drafts: unknown[]) => drafts.map((d, i) => ({ id: `c${i}`, ...(d as object) })));
  logEvent.mockResolvedValue(undefined);
  delete process.env.ARTICLE_SEARCH_ENABLED;
});

describe("collectArticleUrlCandidates — mock 모드 (ARTICLE_SEARCH_ENABLED 미설정)", () => {
  it("mock 후보를 생성하고 전부 새로 저장되면 duplicateCount=0, attempted/failedTaskCount=0이다", async () => {
    const result = await collectArticleUrlCandidates(makeTheme());

    expect(result.saved.length).toBeGreaterThan(0);
    expect(result.totalFound).toBe(result.saved.length);
    expect(result.duplicateCount).toBe(0);
    expect(result.attemptedTaskCount).toBe(0);
    expect(result.failedTaskCount).toBe(0);
  });

  it("일부가 이미 존재해 저장되지 않으면 duplicateCount에 그 개수가 반영된다", async () => {
    upsertArticleUrlCandidates.mockImplementation(async (drafts: unknown[]) =>
      drafts.slice(0, 2).map((d, i) => ({ id: `c${i}`, ...(d as object) }))
    );

    const result = await collectArticleUrlCandidates(makeTheme());

    expect(result.saved.length).toBe(2);
    expect(result.duplicateCount).toBe(result.totalFound - 2);
    expect(result.duplicateCount).toBeGreaterThan(0);
  });
});

describe("collectArticleUrlCandidates — 실제 API 모드 (ARTICLE_SEARCH_ENABLED=true)", () => {
  beforeEach(() => {
    process.env.ARTICLE_SEARCH_ENABLED = "true";
  });

  it("모든 검색이 실패하면 예외를 던진다(설정 오류로 취급)", async () => {
    isNaverKeySet.mockReturnValue(true);
    isDaumKeySet.mockReturnValue(false);
    searchNaverNews.mockRejectedValue(new Error("network error"));

    await expect(collectArticleUrlCandidates(makeTheme())).rejects.toThrow();
    expect(upsertArticleUrlCandidates).not.toHaveBeenCalled();
  });

  it("키가 하나도 설정되지 않으면(시도 자체를 못 하면) 예외를 던진다", async () => {
    isNaverKeySet.mockReturnValue(false);
    isDaumKeySet.mockReturnValue(false);

    await expect(collectArticleUrlCandidates(makeTheme())).rejects.toThrow();
  });

  it("일부 검색은 성공하고 일부는 실패하면 예외 없이 attemptedTaskCount/failedTaskCount에 반영된다", async () => {
    isNaverKeySet.mockReturnValue(true);
    isDaumKeySet.mockReturnValue(true);
    searchNaverNews.mockResolvedValue([
      { platform: "naver", keyword: "AI", title: "AI 뉴스", snippet: "", url: "https://a.example/1", publishedAt: "2026-01-01" },
    ]);
    searchDaumNews.mockRejectedValue(new Error("daum down"));

    const result = await collectArticleUrlCandidates(makeTheme());

    expect(result.attemptedTaskCount).toBeGreaterThan(0);
    expect(result.failedTaskCount).toBeGreaterThan(0);
    expect(result.failedTaskCount).toBeLessThan(result.attemptedTaskCount);
    expect(result.saved.length).toBeGreaterThan(0);
  });

  it("모든 검색이 성공하면 failedTaskCount=0이다", async () => {
    isNaverKeySet.mockReturnValue(true);
    isDaumKeySet.mockReturnValue(false);
    searchNaverNews.mockResolvedValue([
      { platform: "naver", keyword: "AI", title: "AI 뉴스", snippet: "", url: "https://a.example/1", publishedAt: "2026-01-01" },
    ]);

    const result = await collectArticleUrlCandidates(makeTheme());

    expect(result.failedTaskCount).toBe(0);
    expect(result.attemptedTaskCount).toBeGreaterThan(0);
  });
});
