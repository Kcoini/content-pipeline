import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import type { TrendSearchResult } from "./types";

const searchNaverNews = vi.fn();
const searchDaumNewsMultiPage = vi.fn();
const insertTrendCandidates = vi.fn();
const getRecentTrendCandidates = vi.fn();
const getThemeClusters = vi.fn();
const getTrendCandidateCounts = vi.fn();
const logEvent = vi.fn();

vi.mock("./naver-client", () => ({
  searchNaverNews: (...args: unknown[]) => searchNaverNews(...args),
}));
vi.mock("./daum-client", () => ({
  searchDaumNewsMultiPage: (...args: unknown[]) => searchDaumNewsMultiPage(...args),
}));
vi.mock("@/lib/repositories/trend-repository", async () => {
  const actual = await vi.importActual<typeof import("@/lib/repositories/trend-repository")>(
    "@/lib/repositories/trend-repository"
  );
  return {
    ...actual,
    insertTrendCandidates: (...args: unknown[]) => insertTrendCandidates(...args),
    getRecentTrendCandidates: (...args: unknown[]) => getRecentTrendCandidates(...args),
    getThemeClusters: (...args: unknown[]) => getThemeClusters(...args),
    getTrendCandidateCounts: (...args: unknown[]) => getTrendCandidateCounts(...args),
  };
});
vi.mock("@/lib/repositories/log-repository", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { isTrendEnabled, isNaverKeySet, isDaumKeySet, collectTrendCandidates, getTrendPageData } = await import(
  "./trend-service"
);
const { SEED_QUERIES } = await import("./seed-queries");
const { expandDaumQueries } = await import("./daum-query-expansion");

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isTrendEnabled", () => {
  it("TREND_COLLECTION_ENABLED=false이면 false를 반환한다", () => {
    vi.stubEnv("TREND_COLLECTION_ENABLED", "false");
    expect(isTrendEnabled()).toBe(false);
  });

  it("TREND_COLLECTION_ENABLED=true이면 true를 반환한다", () => {
    vi.stubEnv("TREND_COLLECTION_ENABLED", "true");
    expect(isTrendEnabled()).toBe(true);
  });

  it("환경변수가 없으면 false를 반환한다", () => {
    vi.stubEnv("TREND_COLLECTION_ENABLED", "");
    expect(isTrendEnabled()).toBe(false);
  });
});

describe("isNaverKeySet", () => {
  it("ID와 Secret이 모두 있으면 true를 반환한다", () => {
    vi.stubEnv("NAVER_CLIENT_ID", "test-id");
    vi.stubEnv("NAVER_CLIENT_SECRET", "test-secret");
    expect(isNaverKeySet()).toBe(true);
  });

  it("ID가 없으면 false를 반환한다", () => {
    vi.stubEnv("NAVER_CLIENT_ID", "");
    vi.stubEnv("NAVER_CLIENT_SECRET", "test-secret");
    expect(isNaverKeySet()).toBe(false);
  });

  it("Secret이 없으면 false를 반환한다", () => {
    vi.stubEnv("NAVER_CLIENT_ID", "test-id");
    vi.stubEnv("NAVER_CLIENT_SECRET", "");
    expect(isNaverKeySet()).toBe(false);
  });
});

describe("isDaumKeySet", () => {
  it("KAKAO_REST_API_KEY가 있으면 true를 반환한다", () => {
    vi.stubEnv("KAKAO_REST_API_KEY", "test-key");
    expect(isDaumKeySet()).toBe(true);
  });

  it("KAKAO_REST_API_KEY가 없으면 false를 반환한다", () => {
    vi.stubEnv("KAKAO_REST_API_KEY", "");
    expect(isDaumKeySet()).toBe(false);
  });
});

function makeResult(overrides: Partial<TrendSearchResult> = {}): TrendSearchResult {
  return {
    platform: "naver",
    keyword: "AI",
    title: "제목",
    snippet: "요약",
    url: "https://example.com/1",
    rankPosition: 1,
    publishedAt: null,
    ...overrides,
  };
}

describe("collectTrendCandidates (Phase 1-17: naver/daum 수집 균형 개선)", () => {
  beforeEach(() => {
    searchNaverNews.mockReset();
    searchDaumNewsMultiPage.mockReset();
    insertTrendCandidates.mockReset();
    logEvent.mockReset();

    vi.stubEnv("TREND_COLLECTION_ENABLED", "true");
    vi.stubEnv("NAVER_CLIENT_ID", "test-naver-id");
    vi.stubEnv("NAVER_CLIENT_SECRET", "test-naver-secret");
    vi.stubEnv("KAKAO_REST_API_KEY", "test-kakao-key-abcdefgh");

    logEvent.mockResolvedValue({});
    searchNaverNews.mockResolvedValue([makeResult({ platform: "naver" })]);
    searchDaumNewsMultiPage.mockResolvedValue([makeResult({ platform: "daum", url: "https://daum.example.com/1" })]);
    insertTrendCandidates.mockImplementation(async (inputs) =>
      inputs.map((input: Record<string, unknown>, index: number) => ({
        id: `saved-${index}`,
        platform: input.platform,
        keyword: input.keyword,
        title: input.title,
        snippet: input.snippet,
        url: input.url,
        rankPosition: input.rankPosition,
        collectedAt: input.collectedAt,
        createdAt: input.collectedAt,
      }))
    );
  });

  it("네이버는 SEED_QUERIES 그대로(확장 없이) 호출한다 — 네이버 수집 로직은 영향받지 않는다", async () => {
    await collectTrendCandidates();

    expect(searchNaverNews).toHaveBeenCalledTimes(SEED_QUERIES.length);
    for (const query of SEED_QUERIES) {
      expect(searchNaverNews).toHaveBeenCalledWith(query, 5);
    }
  });

  it("다음(카카오)은 SEED_QUERIES보다 많은, 확장된 검색어로 호출한다", async () => {
    await collectTrendCandidates();

    const expectedQueries = expandDaumQueries(SEED_QUERIES);
    expect(searchDaumNewsMultiPage).toHaveBeenCalledTimes(expectedQueries.length);
    expect(expectedQueries.length).toBeGreaterThan(SEED_QUERIES.length);
  });

  it("동일 URL의 naver/daum 결과가 있으면 최종 저장 전 중복을 제거한다", async () => {
    const sharedUrl = "https://example.com/shared";
    searchNaverNews.mockResolvedValue([makeResult({ platform: "naver", url: sharedUrl })]);
    searchDaumNewsMultiPage.mockResolvedValue([makeResult({ platform: "daum", url: sharedUrl })]);

    await collectTrendCandidates();

    const savedInputs = insertTrendCandidates.mock.calls[0][0];
    const urls = savedInputs.map((i: { url: string }) => i.url);
    expect(urls.filter((u: string) => u === sharedUrl)).toHaveLength(1);
  });

  it("daum_trend_collection_completed 로그에 raw/saved count가 구조화된 필드로 남는다", async () => {
    await collectTrendCandidates();

    const call = logEvent.mock.calls.find(
      (args: unknown[]) => (args[0] as { type: string }).type === "daum_trend_collection_completed"
    );
    expect(call).toBeDefined();
    const details = (call![0] as { details: Record<string, unknown> }).details;
    expect(details).toHaveProperty("rawDocumentsCount");
    expect(details).toHaveProperty("savedCount");
    expect(details).toHaveProperty("filteredOutCount");
    expect(details).toHaveProperty("skippedReasonsSummary");
  });

  it("logEvent 호출 전체에 API key/Authorization 문자열이 남지 않는다", async () => {
    await collectTrendCandidates();

    const serialized = JSON.stringify(logEvent.mock.calls);
    expect(serialized).not.toContain("test-kakao-key-abcdefgh");
    expect(serialized).not.toContain("test-naver-secret");
    expect(serialized.toLowerCase()).not.toContain("authorization");
  });

  it("daum 결과가 publisher 필드 없이 와도 전부 제외되지 않는다(url만 있으면 유지)", async () => {
    searchDaumNewsMultiPage.mockResolvedValue([
      makeResult({ platform: "daum", url: "https://daum.example.com/no-publisher" }),
    ]);

    await collectTrendCandidates();

    const savedInputs = insertTrendCandidates.mock.calls[0][0];
    expect(savedInputs.some((i: { platform: string }) => i.platform === "daum")).toBe(true);
  });

  it("daum 응답이 전부 실패해도 naver 결과는 정상 저장된다", async () => {
    searchDaumNewsMultiPage.mockRejectedValue(new Error("카카오 API 오류"));

    const result = await collectTrendCandidates();

    expect(result.naverStatus).toBe("success");
    expect(result.naverCount).toBeGreaterThan(0);
  });
});

describe("getTrendPageData (Phase 1-20: /trends 상단 수집 결과 요약)", () => {
  beforeEach(() => {
    getRecentTrendCandidates.mockReset();
    getThemeClusters.mockReset();
    getTrendCandidateCounts.mockReset();
  });

  it("candidates/clusters/counts와 가장 최근 collectedAt을 함께 반환한다", async () => {
    const candidates = [
      { id: "a", platform: "naver", keyword: null, title: null, snippet: null, url: null, rankPosition: null, collectedAt: "2026-09-05T09:00:00.000Z", createdAt: "2026-09-05T09:00:00.000Z" },
      { id: "b", platform: "daum", keyword: null, title: null, snippet: null, url: null, rankPosition: null, collectedAt: "2026-09-05T09:17:32.000Z", createdAt: "2026-09-05T09:17:32.000Z" },
    ];
    getRecentTrendCandidates.mockResolvedValue(candidates);
    getThemeClusters.mockResolvedValue([]);
    getTrendCandidateCounts.mockResolvedValue({ naver: 248, daum: 103, mock: 0, total: 351 });

    const result = await getTrendPageData();

    expect(result.candidates).toEqual(candidates);
    expect(result.clusters).toEqual([]);
    expect(result.counts).toEqual({ naver: 248, daum: 103, mock: 0, total: 351 });
    expect(result.lastCollectedAt).toBe("2026-09-05T09:17:32.000Z");
  });

  it("candidates가 비어 있으면 lastCollectedAt은 null이다", async () => {
    getRecentTrendCandidates.mockResolvedValue([]);
    getThemeClusters.mockResolvedValue([]);
    getTrendCandidateCounts.mockResolvedValue({ naver: 0, daum: 0, mock: 0, total: 0 });

    const result = await getTrendPageData();

    expect(result.lastCollectedAt).toBeNull();
  });
});
