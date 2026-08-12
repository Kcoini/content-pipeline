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
  saveSocialPostRevision,
  requestSocialPostApproval,
  approveSocialPost,
  rejectSocialPost,
  revokeSocialPostApproval,
  updateSocialPostExport,
  incrementExportCopyCount,
  listExportReadySocialPostsByArticle,
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
    edited_at: null,
    edited_by: null,
    review_notes: null,
    revision_count: 0,
    last_quality_checked_at: null,
    approval_requested_at: null,
    rejection_reason: null,
    revoked_at: null,
    revoked_reason: null,
    export_status: "not_exported",
    exported_at: null,
    exported_by: null,
    export_error: null,
    export_copy_count: 0,
    last_copied_at: null,
    export_notes: null,
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
  chain.in = vi.fn(self);
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

describe("saveSocialPostRevision (Phase 3-4)", () => {
  it("수정 시 revision_count가 증가하고 quality_status/approval_status가 초기화된다", async () => {
    const row = makeSocialPostRow({
      revision_count: 2,
      quality_status: "ready",
      approval_status: "approved",
      approved_by: "editor",
      approved_at: "2026-01-02T00:00:00.000Z",
    });
    const chain = makeChain({ data: row, error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    await saveSocialPostRevision("social-post-1", { postTitle: "새 제목" });

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        revision_count: 3,
        quality_status: "not_checked",
        approval_status: "not_requested",
        approved_by: null,
        approved_at: null,
        rejection_reason: null,
        post_title: "새 제목",
      })
    );
  });

  it("게시된(published) social post는 수정할 수 없다", async () => {
    const row = makeSocialPostRow({ publish_status: "published" });
    const chain = makeChain({ data: row, error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    await expect(saveSocialPostRevision("social-post-1", { postTitle: "새 제목" })).rejects.toThrow();
  });
});

describe("승인/반려/승인취소 (Phase 3-4)", () => {
  it("requestSocialPostApproval은 approval_status를 pending_review로 바꾼다", async () => {
    const row = makeSocialPostRow();
    const chain = makeChain({ data: row, error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    await requestSocialPostApproval("social-post-1", "검토 부탁드립니다");

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ approval_status: "pending_review" })
    );
  });

  it("approveSocialPost 성공 시 social_post_approvals에 approved 이력을 남긴다", async () => {
    const row = makeSocialPostRow();
    const chain = makeChain({ data: row, error: null });
    const from = vi.fn(() => chain);
    createServerSupabaseClient.mockReturnValue({ from });

    await approveSocialPost("social-post-1", "editor", "확인했습니다");

    expect(from).toHaveBeenCalledWith("social_post_approvals");
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ approval_status: "approved", approved_by: "editor" })
    );
  });

  it("rejectSocialPost 성공 시 social_post_approvals에 rejected 이력을 남긴다", async () => {
    const row = makeSocialPostRow();
    const chain = makeChain({ data: row, error: null });
    const from = vi.fn(() => chain);
    createServerSupabaseClient.mockReturnValue({ from });

    await rejectSocialPost("social-post-1", "editor", "문체가 부적절합니다");

    expect(from).toHaveBeenCalledWith("social_post_approvals");
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ approval_status: "rejected", approval_notes: "문체가 부적절합니다" })
    );
  });

  it("revokeSocialPostApproval 성공 시 social_post_approvals에 revoked 이력을 남긴다", async () => {
    const row = makeSocialPostRow({ approval_status: "approved", approved_by: "editor" });
    const chain = makeChain({ data: row, error: null });
    const from = vi.fn(() => chain);
    createServerSupabaseClient.mockReturnValue({ from });

    await revokeSocialPostApproval("social-post-1", "editor", "재검토 필요");

    expect(from).toHaveBeenCalledWith("social_post_approvals");
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ approval_status: "revoked", approval_notes: "재검토 필요" })
    );
  });
});

describe("manual export (Phase 3-5)", () => {
  it("updateSocialPostExport은 exported 상태일 때 exported_at/exported_by를 함께 저장한다", async () => {
    const row = makeSocialPostRow();
    const chain = makeChain({ data: row, error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    await updateSocialPostExport("social-post-1", {
      exportStatus: "exported",
      exportFormat: "naver_blog_markdown_copy",
      exportedBy: "editor",
      markPublishStatusExported: true,
    });

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        export_status: "exported",
        export_format: "naver_blog_markdown_copy",
        exported_by: "editor",
        publish_status: "exported",
      })
    );
  });

  it("updateSocialPostExport은 blocked 상태일 때 exported_at을 건드리지 않는다", async () => {
    const row = makeSocialPostRow();
    const chain = makeChain({ data: row, error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    await updateSocialPostExport("social-post-1", { exportStatus: "blocked", exportError: "사유" });

    const call = (chain.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.export_status).toBe("blocked");
    expect(call.exported_at).toBeUndefined();
  });

  it("incrementExportCopyCount는 export_copy_count를 증가시킨다", async () => {
    const row = makeSocialPostRow({ export_copy_count: 2 });
    const chain = makeChain({ data: row, error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    await incrementExportCopyCount("social-post-1");

    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ export_copy_count: 3 }));
  });

  it("listExportReadySocialPostsByArticle는 export_status가 ready/exported인 것만 조회한다", async () => {
    const rows = [makeSocialPostRow({ export_status: "ready" })];
    const chain = makeChain({ data: rows, error: null });
    const from = vi.fn(() => chain);
    createServerSupabaseClient.mockReturnValue({ from });

    const result = await listExportReadySocialPostsByArticle("article-1");

    expect(chain.eq).toHaveBeenCalledWith("article_id", "article-1");
    expect(result).toHaveLength(1);
  });
});
