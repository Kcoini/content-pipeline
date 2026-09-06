import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ThemeRow } from "@/lib/supabase/database.types";

const createServerSupabaseClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: (...args: unknown[]) => createServerSupabaseClient(...args),
}));

const { mapThemeRowToTheme, getThemes, archiveTheme, getThemeRelatedCounts } = await import("./theme-repository");

function makeChain(result: { data: unknown; error: unknown; count?: number | null }) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.update = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.is = vi.fn(self);
  chain.order = vi.fn(self);
  chain.maybeSingle = vi.fn(() => Promise.resolve(result));
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return chain;
}

beforeEach(() => {
  createServerSupabaseClient.mockReset();
});

function makeThemeRow(overrides: Partial<ThemeRow> = {}): ThemeRow {
  return {
    id: "theme-1",
    title: "AI 에이전트 동향",
    description: "설명",
    keywords: ["AI", "에이전트"],
    language: "ko",
    status: "draft",
    metadata: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    ...overrides,
  };
}

describe("mapThemeRowToTheme", () => {
  it("themes row를 Theme으로 변환한다", () => {
    const theme = mapThemeRowToTheme(makeThemeRow());

    expect(theme).toEqual({
      id: "theme-1",
      title: "AI 에이전트 동향",
      description: "설명",
      keywords: ["AI", "에이전트"],
      language: "ko",
      createdAt: "2026-01-01T00:00:00.000Z",
      metadata: {},
      archivedAt: null,
    });
  });

  it("description이 null이면 빈 문자열로, language가 ko/en이 아니면 ko로 처리한다", () => {
    const theme = mapThemeRowToTheme(
      makeThemeRow({ description: null, language: "fr", keywords: [] })
    );

    expect(theme.description).toBe("");
    expect(theme.language).toBe("ko");
    expect(theme.keywords).toEqual([]);
  });
});

describe("getThemes", () => {
  it("기본적으로 archived_at is null 조건을 사용한다(보관된 테마 제외)", async () => {
    const chain = makeChain({ data: [makeThemeRow()], error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    await getThemes();

    expect(chain.is).toHaveBeenCalledWith("archived_at", null);
  });

  it("includeArchived: true면 archived_at 필터를 사용하지 않는다", async () => {
    const chain = makeChain({ data: [makeThemeRow()], error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    await getThemes({ includeArchived: true });

    expect(chain.is).not.toHaveBeenCalled();
  });
});

describe("archiveTheme", () => {
  it("archived_at을 현재 시각으로 설정한다(hard delete가 아니다)", async () => {
    const chain = makeChain({ data: makeThemeRow({ archived_at: "2026-02-01T00:00:00.000Z" }), error: null });
    const from = vi.fn(() => chain);
    createServerSupabaseClient.mockReturnValue({ from });

    const result = await archiveTheme("theme-1");

    expect(from).toHaveBeenCalledWith("themes");
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ archived_at: expect.any(String) }));
    expect(chain.eq).toHaveBeenCalledWith("id", "theme-1");
    expect(result.archivedAt).toBe("2026-02-01T00:00:00.000Z");
  });

  it("존재하지 않는 테마면 에러를 던진다", async () => {
    const chain = makeChain({ data: null, error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    await expect(archiveTheme("missing-theme")).rejects.toThrow("테마를 찾을 수 없습니다");
  });
});

describe("getThemeRelatedCounts", () => {
  it("연결된 출처/기사 개수를 반환한다", async () => {
    const sourcesChain = makeChain({ data: null, error: null, count: 5 });
    const articlesChain = makeChain({ data: null, error: null, count: 2 });
    const from = vi.fn((table: string) => (table === "sources" ? sourcesChain : articlesChain));
    createServerSupabaseClient.mockReturnValue({ from });

    const counts = await getThemeRelatedCounts("theme-1");

    expect(counts).toEqual({ sourceCount: 5, articleCount: 2 });
  });
});
