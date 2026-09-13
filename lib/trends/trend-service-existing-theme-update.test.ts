// Phase 1-25: existing_theme_update 후보가 "✓ 테마로 저장됨"으로만 끝나는
// 버그를 고치면서 함께 다듬은 addClusterEvidenceToExistingTheme()의 동작
// (새 URL 추가/중복 제외/추가할 URL 없음/로그)을 검증한다.

import { describe, expect, it, vi, beforeEach } from "vitest";

const getThemeClusterById = vi.fn();
const getSourcesByThemeId = vi.fn();
const addSource = vi.fn();
const getThemes = vi.fn();
const updateThemeMetadata = vi.fn();
const getArticleByThemeId = vi.fn();
const listSocialPostsByArticle = vi.fn();
const logEvent = vi.fn();

class DuplicateSourceError extends Error {
  constructor(url: string) {
    super(`이미 이 테마에 등록된 출처입니다. (${url})`);
    this.name = "DuplicateSourceError";
  }
}

vi.mock("@/lib/repositories/trend-repository", async () => {
  const actual = await vi.importActual<typeof import("@/lib/repositories/trend-repository")>(
    "@/lib/repositories/trend-repository"
  );
  return { ...actual, getThemeClusterById: (...args: unknown[]) => getThemeClusterById(...args) };
});
vi.mock("@/lib/repositories/source-repository", () => ({
  getSourcesByThemeId: (...args: unknown[]) => getSourcesByThemeId(...args),
  addSource: (...args: unknown[]) => addSource(...args),
  DuplicateSourceError,
}));
vi.mock("@/lib/repositories/theme-repository", async () => {
  const actual = await vi.importActual<typeof import("@/lib/repositories/theme-repository")>(
    "@/lib/repositories/theme-repository"
  );
  return {
    ...actual,
    getThemes: (...args: unknown[]) => getThemes(...args),
    updateThemeMetadata: (...args: unknown[]) => updateThemeMetadata(...args),
  };
});
vi.mock("@/lib/repositories/article-repository", () => ({
  getArticleByThemeId: (...args: unknown[]) => getArticleByThemeId(...args),
}));
vi.mock("@/lib/repositories/social-posts-repository", () => ({
  listSocialPostsByArticle: (...args: unknown[]) => listSocialPostsByArticle(...args),
}));
vi.mock("@/lib/repositories/log-repository", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { addClusterEvidenceToExistingTheme } = await import("./trend-service");

function makeCluster(overrides: Record<string, unknown> = {}) {
  return {
    id: "cluster-1",
    title: "AI 산업 동향",
    description: "",
    keywords: [],
    naverCount: 3,
    daumCount: 1,
    score: 4,
    status: "selected",
    createdAt: "2026-09-12T00:00:00.000Z",
    updatedAt: "2026-09-12T00:00:00.000Z",
    normalizedKey: "ai 산업 동향",
    subtopics: [],
    evidence: [
      { platform: "naver", title: "기사 A", url: "https://example.com/a" },
      { platform: "naver", title: "기사 B", url: "https://example.com/b" },
    ],
    seenCount: 2,
    lastSeenAt: "2026-09-13T00:00:00.000Z",
    ...overrides,
  };
}

function makeTheme(overrides: Record<string, unknown> = {}) {
  return {
    id: "theme-1",
    title: "AI 산업 동향",
    description: "",
    keywords: [],
    language: "ko",
    createdAt: "2026-09-12T00:00:00.000Z",
    metadata: {},
    archivedAt: null,
    ...overrides,
  };
}

describe("addClusterEvidenceToExistingTheme", () => {
  beforeEach(() => {
    getThemeClusterById.mockReset();
    getSourcesByThemeId.mockReset();
    addSource.mockReset();
    getThemes.mockReset();
    updateThemeMetadata.mockReset();
    getArticleByThemeId.mockReset();
    listSocialPostsByArticle.mockReset();
    logEvent.mockReset();

    logEvent.mockResolvedValue({});
    getThemes.mockResolvedValue([makeTheme()]);
    getArticleByThemeId.mockResolvedValue(undefined);
    listSocialPostsByArticle.mockResolvedValue([]);
    updateThemeMetadata.mockResolvedValue(makeTheme());
  });

  it("새 URL만 추가하고 이미 등록된 URL은 중복 제외한다", async () => {
    getThemeClusterById.mockResolvedValue(makeCluster());
    getSourcesByThemeId.mockResolvedValue([{ id: "s1", themeId: "theme-1", url: "https://example.com/a", createdAt: "2026-09-01T00:00:00.000Z" }]);
    addSource.mockResolvedValue({ id: "new-source" });

    const result = await addClusterEvidenceToExistingTheme("cluster-1", "theme-1");

    expect(result.addedCount).toBe(1);
    expect(result.skippedDuplicateCount).toBe(1);
    expect(addSource).toHaveBeenCalledTimes(1);
    expect(addSource).toHaveBeenCalledWith(expect.objectContaining({ url: "https://example.com/b" }));
  });

  it("추가할 새 URL이 없으면 no_new_urls 로그를 남기고 addedCount=0을 반환한다", async () => {
    getThemeClusterById.mockResolvedValue(makeCluster());
    getSourcesByThemeId.mockResolvedValue([
      { id: "s1", themeId: "theme-1", url: "https://example.com/a", createdAt: "2026-09-01T00:00:00.000Z" },
      { id: "s2", themeId: "theme-1", url: "https://example.com/b", createdAt: "2026-09-01T00:00:00.000Z" },
    ]);

    const result = await addClusterEvidenceToExistingTheme("cluster-1", "theme-1");

    expect(result.addedCount).toBe(0);
    expect(result.skippedDuplicateCount).toBe(2);
    expect(addSource).not.toHaveBeenCalled();
    expect(updateThemeMetadata).not.toHaveBeenCalled();
    const noNewUrlsLog = logEvent.mock.calls.find(
      (call) => (call[0] as { type: string }).type === "theme_candidate_existing_theme_update_no_new_urls"
    );
    expect(noNewUrlsLog).toBeDefined();
  });

  it("시작 시 started 로그를, 클러스터를 찾지 못하면 failed 로그를 남기고 에러를 던진다", async () => {
    getThemeClusterById.mockResolvedValue(undefined);

    await expect(addClusterEvidenceToExistingTheme("missing-cluster", "theme-1")).rejects.toThrow();

    const startedLog = logEvent.mock.calls.find(
      (call) => (call[0] as { type: string }).type === "theme_candidate_existing_theme_update_started"
    );
    const failedLog = logEvent.mock.calls.find(
      (call) => (call[0] as { type: string }).type === "theme_candidate_existing_theme_update_failed"
    );
    expect(startedLog).toBeDefined();
    expect(failedLog).toBeDefined();
  });

  it("새 URL이 추가되면 theme.metadata에 마스터 원고 갱신 권장 플래그를 남긴다(자동 재생성은 하지 않는다)", async () => {
    getThemeClusterById.mockResolvedValue(makeCluster());
    getSourcesByThemeId.mockResolvedValue([]);
    addSource.mockResolvedValue({ id: "new-source" });

    await addClusterEvidenceToExistingTheme("cluster-1", "theme-1");

    expect(updateThemeMetadata).toHaveBeenCalledWith(
      "theme-1",
      expect.objectContaining({ needsMasterManuscriptRefresh: true, lastCrossDayAddedSourceCount: 2 })
    );
  });

  it("이미 등록된 URL은 DuplicateSourceError를 던져도 중복 제외로 처리한다", async () => {
    getThemeClusterById.mockResolvedValue(makeCluster());
    getSourcesByThemeId.mockResolvedValue([]);
    addSource.mockRejectedValueOnce(new DuplicateSourceError("https://example.com/a")).mockResolvedValueOnce({ id: "ok" });

    const result = await addClusterEvidenceToExistingTheme("cluster-1", "theme-1");

    expect(result.addedCount).toBe(1);
    expect(result.skippedDuplicateCount).toBe(1);
  });
});
