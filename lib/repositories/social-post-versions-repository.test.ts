import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SocialPostVersionRow } from "@/lib/supabase/database.types";

const createServerSupabaseClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: (...args: unknown[]) => createServerSupabaseClient(...args),
}));

const {
  createSocialPostVersion,
  listVersionsByRootSocialPost,
  listVersionsByArticle,
  getLatestVersionByRootSocialPost,
  markSocialPostVersionStatus,
  getVersionChain,
  mapSocialPostVersionRow,
} = await import("./social-post-versions-repository");

function makeVersionRow(overrides: Partial<SocialPostVersionRow> = {}): SocialPostVersionRow {
  return {
    id: "version-1",
    social_post_id: "social-post-1",
    article_id: "article-1",
    root_social_post_id: "social-post-1",
    parent_social_post_id: null,
    version_number: 1,
    version_label: "원본",
    version_status: "current",
    platform: "naver_blog",
    tone_style: "informational",
    rewrite_source_suggestion_id: null,
    change_summary: {},
    applied_by: null,
    applied_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.insert = vi.fn(self);
  chain.update = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.order = vi.fn(self);
  chain.limit = vi.fn(self);
  chain.single = vi.fn(() => Promise.resolve(result));
  chain.maybeSingle = vi.fn(() => Promise.resolve(result));
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return chain;
}

beforeEach(() => {
  createServerSupabaseClient.mockReset();
});

describe("createSocialPostVersion", () => {
  it("social_post_versions에 row를 insert한다", async () => {
    const row = makeVersionRow();
    const chain = makeChain({ data: row, error: null });
    const from = vi.fn(() => chain);
    createServerSupabaseClient.mockReturnValue({ from });

    const result = await createSocialPostVersion({
      socialPostId: "social-post-1",
      articleId: "article-1",
      rootSocialPostId: "social-post-1",
      versionNumber: 1,
      platform: "naver_blog",
      toneStyle: "informational",
    });

    expect(from).toHaveBeenCalledWith("social_post_versions");
    expect(result.id).toBe("version-1");
  });
});

describe("listVersionsByRootSocialPost / listVersionsByArticle", () => {
  it("root_social_post_id 기준으로 버전 순 조회한다", async () => {
    const rows = [makeVersionRow(), makeVersionRow({ id: "version-2", version_number: 2 })];
    const chain = makeChain({ data: rows, error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const result = await listVersionsByRootSocialPost("social-post-1");

    expect(chain.eq).toHaveBeenCalledWith("root_social_post_id", "social-post-1");
    expect(result).toHaveLength(2);
  });

  it("article_id 기준으로 조회한다", async () => {
    const chain = makeChain({ data: [makeVersionRow()], error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const result = await listVersionsByArticle("article-1");

    expect(chain.eq).toHaveBeenCalledWith("article_id", "article-1");
    expect(result).toHaveLength(1);
  });
});

describe("getLatestVersionByRootSocialPost", () => {
  it("가장 최근 버전을 반환한다", async () => {
    const chain = makeChain({ data: makeVersionRow({ version_number: 3 }), error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const result = await getLatestVersionByRootSocialPost("social-post-1");

    expect(result?.versionNumber).toBe(3);
  });
});

describe("markSocialPostVersionStatus", () => {
  it("social_post_id 기준으로 version_status를 갱신한다", async () => {
    const chain = makeChain({ data: makeVersionRow({ version_status: "superseded" }), error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const result = await markSocialPostVersionStatus("social-post-1", "superseded");

    expect(chain.update).toHaveBeenCalledWith({ version_status: "superseded" });
    expect(chain.eq).toHaveBeenCalledWith("social_post_id", "social-post-1");
    expect(result?.versionStatus).toBe("superseded");
  });
});

describe("getVersionChain", () => {
  it("social_post_id로 root를 찾아 전체 계보를 반환한다", async () => {
    const currentChain = makeChain({ data: makeVersionRow({ root_social_post_id: "root-1" }), error: null });
    const rootChain = makeChain({ data: [makeVersionRow({ root_social_post_id: "root-1" })], error: null });
    const from = vi.fn().mockReturnValueOnce(currentChain).mockReturnValueOnce(rootChain);
    createServerSupabaseClient.mockReturnValue({ from });

    const result = await getVersionChain("social-post-1");

    expect(result).toHaveLength(1);
  });

  it("버전 정보가 없으면 빈 배열을 반환한다", async () => {
    const chain = makeChain({ data: null, error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const result = await getVersionChain("missing");

    expect(result).toEqual([]);
  });
});

describe("mapSocialPostVersionRow", () => {
  it("row를 도메인 타입으로 매핑한다", () => {
    const mapped = mapSocialPostVersionRow(makeVersionRow());
    expect(mapped).toMatchObject({ id: "version-1", socialPostId: "social-post-1", versionNumber: 1 });
  });
});
