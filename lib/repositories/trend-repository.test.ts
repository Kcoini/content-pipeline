import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ThemeClusterRow, TrendCandidateRow } from "@/lib/supabase/database.types";
import type { TrendCandidate } from "@/lib/types/domain";

const createServerSupabaseClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: (...args: unknown[]) => createServerSupabaseClient(...args),
}));

const { upsertThemeClusters, balanceCandidatesByPlatform, getRecentTrendCandidates, getTrendCandidateCounts } =
  await import("./trend-repository");

function makeClusterRow(overrides: Partial<ThemeClusterRow> = {}): ThemeClusterRow {
  return {
    id: "cluster-1",
    title: "AI 산업 동향",
    description: "설명",
    keywords: ["AI"],
    naver_count: 2,
    daum_count: 1,
    score: 6,
    status: "candidate",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    normalized_key: "ai 동향 산업",
    subtopics: [],
    evidence: [],
    seen_count: 1,
    last_seen_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** select()가 배열(전체 조회)과 single()/eq() 체인(단건 update) 양쪽에 쓰이도록 하는 mock 헬퍼. */
function makeSupabaseMock(existingRows: ThemeClusterRow[], insertedOrUpdatedRow: ThemeClusterRow) {
  const insert = vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn(() => Promise.resolve({ data: insertedOrUpdatedRow, error: null })),
    })),
  }));
  const update = vi.fn(() => ({
    eq: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: insertedOrUpdatedRow, error: null })),
      })),
    })),
  }));

  const from = vi.fn(() => ({
    select: vi.fn(() => Promise.resolve({ data: existingRows, error: null })),
    insert,
    update,
  }));

  return { from, insert, update };
}

beforeEach(() => {
  createServerSupabaseClient.mockReset();
});

describe("upsertThemeClusters", () => {
  it("기존에 같은 normalizedKey를 가진 후보가 없으면 새로 insert한다", async () => {
    const inserted = makeClusterRow({ id: "cluster-new" });
    const { from, insert } = makeSupabaseMock([], inserted);
    createServerSupabaseClient.mockReturnValue({ from });

    const result = await upsertThemeClusters([
      {
        title: "AI 산업 동향",
        description: "설명",
        keywords: ["AI"],
        naverCount: 2,
        daumCount: 1,
        score: 6,
        normalizedKey: "ai 동향 산업",
        subtopics: [],
        evidence: [],
      },
    ]);

    expect(insert).toHaveBeenCalled();
    expect(result[0].id).toBe("cluster-new");
  });

  it("같은 normalizedKey를 가진 기존 후보가 있으면 insert 대신 update(병합)한다", async () => {
    const existing = makeClusterRow({ normalized_key: "ai 동향 산업", naver_count: 2, daum_count: 1, seen_count: 1 });
    const merged = makeClusterRow({
      normalized_key: "ai 동향 산업",
      naver_count: 5,
      daum_count: 2,
      seen_count: 2,
    });
    const { from, insert, update } = makeSupabaseMock([existing], merged);
    createServerSupabaseClient.mockReturnValue({ from });

    const result = await upsertThemeClusters([
      {
        title: "AI 산업 동향",
        description: "설명",
        keywords: ["AI"],
        naverCount: 3,
        daumCount: 1,
        score: 7,
        normalizedKey: "ai 동향 산업",
        subtopics: ["AI 에이전트 상용화"],
        evidence: [{ platform: "naver", title: "새 근거", url: null }],
      },
    ]);

    expect(insert).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        naver_count: 5, // 기존 2 + 신규 3
        daum_count: 2, // 기존 1 + 신규 1
        seen_count: 2, // 기존 1 + 1
      })
    );
    expect(result[0].seenCount).toBe(2);
  });

  it("normalizedKey는 다르지만 제목 유사도가 임계값 이상인 candidate 상태 후보는 병합한다", async () => {
    const existing = makeClusterRow({
      title: "제주 신혼부부 청년 주거 지원 2026",
      normalized_key: "신혼부부 주거 제주 청년",
      status: "candidate",
    });
    const merged = makeClusterRow({ title: "제주 신혼부부 청년 주거 지원 2026", seen_count: 2 });
    const { from, insert, update } = makeSupabaseMock([existing], merged);
    createServerSupabaseClient.mockReturnValue({ from });

    const result = await upsertThemeClusters([
      {
        title: "제주 청년 신혼부부 주거지원 조건",
        description: "설명",
        keywords: ["주거"],
        naverCount: 1,
        daumCount: 0,
        score: 1,
        normalizedKey: "다른키",
        subtopics: [],
        evidence: [],
      },
    ]);

    expect(insert).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalled();
    expect(result[0].seenCount).toBe(2);
  });

  it("제목 유사도가 낮으면 별도 후보로 insert한다", async () => {
    const existing = makeClusterRow({ title: "반도체 수출 동향", normalized_key: "동향 반도체 수출" });
    const inserted = makeClusterRow({ id: "cluster-new-2", title: "전기차 배터리 산업" });
    const { from, insert } = makeSupabaseMock([existing], inserted);
    createServerSupabaseClient.mockReturnValue({ from });

    const result = await upsertThemeClusters([
      {
        title: "전기차 배터리 산업",
        description: "설명",
        keywords: ["전기차"],
        naverCount: 1,
        daumCount: 0,
        score: 1,
        normalizedKey: "배터리 산업 전기차",
        subtopics: [],
        evidence: [],
      },
    ]);

    expect(insert).toHaveBeenCalled();
    expect(result[0].id).toBe("cluster-new-2");
  });

  it("이미 selected/dismissed 상태인 후보는 제목 유사도만으로는 병합하지 않는다(normalizedKey가 정확히 같을 때만 병합)", async () => {
    const existingSelected = makeClusterRow({
      title: "제주 신혼부부 청년 주거 지원 2026",
      normalized_key: "신혼부부 주거 제주 청년",
      status: "selected",
    });
    const inserted = makeClusterRow({ id: "cluster-new-3", title: "제주 청년 신혼부부 주거지원 조건" });
    const { from, insert, update } = makeSupabaseMock([existingSelected], inserted);
    createServerSupabaseClient.mockReturnValue({ from });

    const result = await upsertThemeClusters([
      {
        title: "제주 청년 신혼부부 주거지원 조건",
        description: "설명",
        keywords: ["주거"],
        naverCount: 1,
        daumCount: 0,
        score: 1,
        normalizedKey: "다른키",
        subtopics: [],
        evidence: [],
      },
    ]);

    expect(update).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalled();
    expect(result[0].id).toBe("cluster-new-3");
  });
});

function makeCandidate(overrides: Partial<TrendCandidate> = {}): TrendCandidate {
  return {
    id: "c-1",
    platform: "naver",
    keyword: "AI",
    title: "제목",
    snippet: "요약",
    url: "https://example.com/1",
    rankPosition: 1,
    collectedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("balanceCandidatesByPlatform (Phase 1-17: daum 결과가 화면에서 거의 안 보이던 문제 수정)", () => {
  it("naver가 앞쪽에 몰려 있어도 daum이 limit 안에 공평하게 포함된다", () => {
    // 실측 재현: naver 46건이 daum 47건보다 앞쪽에 몰려 있는 상황(같은 배치, 동일 timestamp).
    const naverRows = Array.from({ length: 46 }, (_, i) => makeCandidate({ id: `naver-${i}`, platform: "naver" }));
    const daumRows = Array.from({ length: 47 }, (_, i) => makeCandidate({ id: `daum-${i}`, platform: "daum" }));
    const rows = [...naverRows, ...daumRows]; // naver가 배열 앞쪽에 몰려 있는 실제 상황 재현

    const result = balanceCandidatesByPlatform(rows, 50);

    const naverCount = result.filter((r) => r.platform === "naver").length;
    const daumCount = result.filter((r) => r.platform === "daum").length;

    expect(daumCount).toBeGreaterThan(4); // 이전 버그였다면 4건 근처로 나왔을 것
    expect(naverCount).toBeGreaterThan(0);
    // 두 플랫폼이 거의 동등하게 포함돼야 한다(라운드로빈이므로 최대 1건 차이).
    expect(Math.abs(naverCount - daumCount)).toBeLessThanOrEqual(1);
  });

  it("각 플랫폼 내부의 순서(최신순)는 유지된다", () => {
    const naverRows = [
      makeCandidate({ id: "naver-1", platform: "naver" }),
      makeCandidate({ id: "naver-2", platform: "naver" }),
    ];
    const daumRows = [makeCandidate({ id: "daum-1", platform: "daum" })];

    const result = balanceCandidatesByPlatform([...naverRows, ...daumRows], 10);

    const naverIds = result.filter((r) => r.platform === "naver").map((r) => r.id);
    expect(naverIds).toEqual(["naver-1", "naver-2"]);
  });

  it("limit이 전체 후보 수보다 크면 전체를 그대로 반환한다", () => {
    const rows = [makeCandidate({ id: "a", platform: "naver" }), makeCandidate({ id: "b", platform: "daum" })];

    const result = balanceCandidatesByPlatform(rows, 50);

    expect(result).toHaveLength(2);
  });

  it("플랫폼이 하나뿐이면 그 플랫폼만으로 limit을 채운다", () => {
    const rows = Array.from({ length: 10 }, (_, i) => makeCandidate({ id: `naver-${i}`, platform: "naver" }));

    const result = balanceCandidatesByPlatform(rows, 5);

    expect(result).toHaveLength(5);
    expect(result.every((r) => r.platform === "naver")).toBe(true);
  });

  it("빈 배열이면 빈 배열을 반환한다", () => {
    expect(balanceCandidatesByPlatform([], 50)).toEqual([]);
  });
});

describe("getRecentTrendCandidates (Phase 1-17)", () => {
  function makeCandidateRow(overrides: Partial<TrendCandidateRow> = {}): TrendCandidateRow {
    return {
      id: "c-1",
      platform: "naver",
      keyword: "AI",
      title: "제목",
      snippet: "요약",
      url: "https://example.com/1",
      rank_position: 1,
      collected_at: "2026-01-01T00:00:00.000Z",
      metadata: {},
      created_at: "2026-01-01T00:00:00.000Z",
      ...overrides,
    };
  }

  it("limit보다 넉넉히 조회한 뒤 플랫폼별로 공평하게 섞어 반환한다", async () => {
    const naverRows = Array.from({ length: 46 }, (_, i) => makeCandidateRow({ id: `naver-${i}`, platform: "naver" }));
    const daumRows = Array.from({ length: 47 }, (_, i) => makeCandidateRow({ id: `daum-${i}`, platform: "daum" }));
    const allRows = [...naverRows, ...daumRows];

    const chain: Record<string, unknown> = {};
    const self = () => chain;
    chain.select = vi.fn(self);
    chain.order = vi.fn(self);
    chain.limit = vi.fn(() => Promise.resolve({ data: allRows, error: null }));
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const result = await getRecentTrendCandidates(50);

    expect(chain.limit).toHaveBeenCalledWith(200); // Math.max(50*4, 200)
    const daumCount = result.filter((r) => r.platform === "daum").length;
    expect(daumCount).toBeGreaterThan(4);
  });
});

describe("getTrendCandidateCounts (Phase 1-20: /trends 상단 수집 결과 요약)", () => {
  it("플랫폼별 count-only 쿼리 결과를 합산해 반환한다", async () => {
    function makeCountChain(count: number) {
      const chain: Record<string, unknown> = {};
      const self = () => chain;
      chain.select = vi.fn(self);
      chain.eq = vi.fn(() => Promise.resolve({ count, error: null }));
      return chain;
    }

    const naverChain = makeCountChain(248);
    const daumChain = makeCountChain(103);
    const mockChain = makeCountChain(0);

    // eq() 호출 인자(플랫폼)로 매번 구분하지 않고, Promise.all 호출 순서
    // (naver→daum→mock)에 맞춰 순서대로 다른 체인을 반환한다.
    let callIndex = 0;
    const chains = [naverChain, daumChain, mockChain];
    createServerSupabaseClient.mockReturnValue({
      from: vi.fn(() => chains[callIndex++]),
    });

    const result = await getTrendCandidateCounts();

    expect(result).toEqual({ naver: 248, daum: 103, mock: 0, total: 351 });
  });

  it("count가 null이면 0으로 처리한다", async () => {
    function makeCountChain(count: number | null) {
      const chain: Record<string, unknown> = {};
      const self = () => chain;
      chain.select = vi.fn(self);
      chain.eq = vi.fn(() => Promise.resolve({ count, error: null }));
      return chain;
    }

    let callIndex = 0;
    const chains = [makeCountChain(null), makeCountChain(null), makeCountChain(null)];
    createServerSupabaseClient.mockReturnValue({
      from: vi.fn(() => chains[callIndex++]),
    });

    const result = await getTrendCandidateCounts();

    expect(result).toEqual({ naver: 0, daum: 0, mock: 0, total: 0 });
  });

  it("쿼리 중 하나라도 실패하면 에러를 던진다", async () => {
    function makeCountChain(result: { count: number | null; error: unknown }) {
      const chain: Record<string, unknown> = {};
      const self = () => chain;
      chain.select = vi.fn(self);
      chain.eq = vi.fn(() => Promise.resolve(result));
      return chain;
    }

    let callIndex = 0;
    const chains = [
      makeCountChain({ count: 10, error: null }),
      makeCountChain({ count: null, error: { message: "DB 오류" } }),
      makeCountChain({ count: 0, error: null }),
    ];
    createServerSupabaseClient.mockReturnValue({
      from: vi.fn(() => chains[callIndex++]),
    });

    await expect(getTrendCandidateCounts()).rejects.toThrow("트렌드 후보 개수 조회에 실패했습니다");
  });
});
