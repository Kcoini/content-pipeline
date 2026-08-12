import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SocialPostRow } from "@/lib/supabase/database.types";

const createServerSupabaseClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: (...args: unknown[]) => createServerSupabaseClient(...args),
}));

const {
  createSocialPostDraft,
  listSocialPostsByArticle,
  mapSocialPostRow,
  InvalidSocialPlatformError,
  InvalidToneStyleError,
} = await import("./social-posts-repository");

function makeSocialPostRow(overrides: Partial<SocialPostRow> = {}): SocialPostRow {
  return {
    id: "social-post-1",
    article_id: "article-1",
    platform: "naver_blog",
    tone_style: "informational",
    post_title: "제목",
    post_body: "본문",
    caption: null,
    excerpt: null,
    hashtags: ["장기요양보험"],
    thread_items: [],
    card_items: [],
    media_requirements: {},
    platform_metadata: {},
    generation_context: {},
    quality_status: "not_checked",
    quality_score: null,
    quality_summary: {},
    approval_status: "not_requested",
    approved_by: null,
    approved_at: null,
    publish_status: "not_published",
    external_post_id: null,
    post_url: null,
    export_format: null,
    export_payload: {},
    error_message: null,
    generated_at: "2026-01-01T00:00:00.000Z",
    reviewed_at: null,
    published_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** supabase-js의 chainable query builder를 흉내낸다 (모든 메서드가 this를 반환하며, awaitable). */
function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.insert = vi.fn(self);
  chain.update = vi.fn(self);
  chain.delete = vi.fn(self);
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

describe("createSocialPostDraft", () => {
  it("유효한 platform/tone_style이면 social post를 생성한다", async () => {
    const row = makeSocialPostRow();
    const chain = makeChain({ data: row, error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const result = await createSocialPostDraft({
      articleId: "article-1",
      platform: "naver_blog",
      toneStyle: "informational",
    });

    expect(result.id).toBe("social-post-1");
    expect(result.platform).toBe("naver_blog");
    expect(chain.insert).toHaveBeenCalledTimes(1);
  });

  it("invalid platform이면 거부한다 (DB 호출 없음)", async () => {
    await expect(
      createSocialPostDraft({
        articleId: "article-1",
        // @ts-expect-error 의도적으로 잘못된 값을 전달
        platform: "facebook",
        toneStyle: "informational",
      })
    ).rejects.toThrow(InvalidSocialPlatformError);

    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it("invalid tone_style이면 거부한다 (DB 호출 없음)", async () => {
    await expect(
      createSocialPostDraft({
        articleId: "article-1",
        platform: "naver_blog",
        // @ts-expect-error 의도적으로 잘못된 값을 전달
        toneStyle: "threat",
      })
    ).rejects.toThrow(InvalidToneStyleError);

    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });
});

describe("listSocialPostsByArticle", () => {
  it("article_id 기준으로 social post 목록을 조회한다", async () => {
    const rows = [makeSocialPostRow({ id: "sp-1" }), makeSocialPostRow({ id: "sp-2" })];
    const chain = makeChain({ data: rows, error: null });
    const from = vi.fn(() => chain);
    createServerSupabaseClient.mockReturnValue({ from });

    const result = await listSocialPostsByArticle("article-1");

    expect(from).toHaveBeenCalledWith("social_posts");
    expect(chain.eq).toHaveBeenCalledWith("article_id", "article-1");
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("sp-1");
  });
});

describe("mapSocialPostRow", () => {
  it("row를 도메인 타입으로 변환한다", () => {
    const row = makeSocialPostRow();
    const post = mapSocialPostRow(row);

    expect(post).toMatchObject({
      id: "social-post-1",
      articleId: "article-1",
      platform: "naver_blog",
      toneStyle: "informational",
      hashtags: ["장기요양보험"],
      qualityStatus: "not_checked",
      approvalStatus: "not_requested",
      publishStatus: "not_published",
    });
  });

  it("article 본문 전체를 다루지 않는다 (post_body/caption만 매핑, 원문 필드 없음)", () => {
    const row = makeSocialPostRow();
    const post = mapSocialPostRow(row);

    expect(post).not.toHaveProperty("articleContent");
    expect(post).not.toHaveProperty("rawContent");
  });
});
