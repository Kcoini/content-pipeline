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
  updatePlatformPublishGuardResult,
  markPlatformPublishGuardFailed,
  listPublishingReadySocialPostsByArticle,
  updatePlatformPublishDryRunResult,
  updatePlatformHandoffResult,
  listDryRunReadySocialPostsByArticle,
  listHandoffReadySocialPostsByArticle,
  updateManualPostingChecklist,
  updateManualPostingResult,
  listManualPostingReadySocialPostsByArticle,
  listManualPostedSocialPostsByArticle,
  createRewriteVersion,
  updateSocialPostVersionStatus,
  listRewriteVersionsByArticle,
  listRewriteVersionsByRoot,
  getSocialPostForVersionComparison,
  updateVersionComparisonSummary,
  listRewriteVersionsNeedingComparison,
  listRecommendedRewriteVersions,
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
    platform_publish_guard_status: "not_checked",
    platform_publish_guard_score: null,
    platform_publish_guard_summary: {},
    platform_publish_guard_error: null,
    platform_publish_guard_checked_at: null,
    platform_publish_ready: false,
    platform_publish_blocked_reason: null,
    platform_publish_dry_run_status: "not_created",
    platform_publish_dry_run_payload: {},
    platform_publish_dry_run_error: null,
    platform_publish_dry_run_created_at: null,
    platform_publish_dry_run_created_by: null,
    handoff_status: "not_started",
    handoff_payload: {},
    handoff_notes: null,
    handoff_completed_at: null,
    handoff_completed_by: null,
    handoff_error: null,
    manual_post_status: "not_recorded",
    manual_post_url: null,
    manual_posted_at: null,
    manual_posted_by: null,
    manual_post_result_notes: null,
    manual_post_error: null,
    manual_post_recorded_at: null,
    manual_post_recorded_by: null,
    manual_post_checklist: [],
    parent_social_post_id: null,
    root_social_post_id: "social-post-1",
    version_number: 1,
    version_label: null,
    version_status: "current",
    rewrite_source_suggestion_id: null,
    rewrite_applied_from_social_post_id: null,
    rewrite_applied_at: null,
    rewrite_applied_by: null,
    rewrite_application_notes: null,
    is_rewrite_version: false,
    latest_version_comparison_id: null,
    version_comparison_status: "not_compared",
    version_comparison_score: null,
    recommended_for_repost: false,
    version_comparison_checked_at: null,
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

describe("platform publishing guard (Phase 3-6)", () => {
  it("updatePlatformPublishGuardResult는 checklist/warnings/failures/blockedReasons를 summary로 저장한다", async () => {
    const row = makeSocialPostRow();
    const chain = makeChain({ data: row, error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    await updatePlatformPublishGuardResult("social-post-1", {
      status: "ready",
      score: 95,
      ready: true,
      checklist: [{ key: "k", label: "l", status: "pass", message: "m" }],
      warnings: [],
      failures: [],
      blockedReasons: [],
    });

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        platform_publish_guard_status: "ready",
        platform_publish_guard_score: 95,
        platform_publish_ready: true,
      })
    );
  });

  it("markPlatformPublishGuardFailed는 status='failed'와 오류 메시지를 저장한다", async () => {
    const row = makeSocialPostRow();
    const chain = makeChain({ data: row, error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    await markPlatformPublishGuardFailed("social-post-1", "예외 발생");

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ platform_publish_guard_status: "failed", platform_publish_guard_error: "예외 발생", platform_publish_ready: false })
    );
  });

  it("listPublishingReadySocialPostsByArticle는 platform_publish_ready=true인 것만 조회한다", async () => {
    const rows = [makeSocialPostRow({ platform_publish_ready: true })];
    const chain = makeChain({ data: rows, error: null });
    const from = vi.fn(() => chain);
    createServerSupabaseClient.mockReturnValue({ from });

    const result = await listPublishingReadySocialPostsByArticle("article-1");

    expect(chain.eq).toHaveBeenCalledWith("platform_publish_ready", true);
    expect(result).toHaveLength(1);
  });
});

describe("platform publish dry-run / handoff (Phase 3-7)", () => {
  it("updatePlatformPublishDryRunResult는 status='ready'일 때 created_at/created_by를 함께 저장한다", async () => {
    const row = makeSocialPostRow();
    const chain = makeChain({ data: row, error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    await updatePlatformPublishDryRunResult("social-post-1", {
      status: "ready",
      dryRunPayload: { type: "manual_copy_handoff" },
      handoffPayload: { type: "manual_copy_handoff" },
      createdBy: "editor",
      handoffStatus: "ready",
    });

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        platform_publish_dry_run_status: "ready",
        platform_publish_dry_run_created_by: "editor",
        handoff_status: "ready",
      })
    );
  });

  it("updatePlatformHandoffResult는 status='completed'일 때 completed_at/completed_by를 저장한다", async () => {
    const row = makeSocialPostRow();
    const chain = makeChain({ data: row, error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    await updatePlatformHandoffResult("social-post-1", { status: "completed", completedBy: "editor", notes: "확인함" });

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ handoff_status: "completed", handoff_notes: "확인함" })
    );
  });

  it("listDryRunReadySocialPostsByArticle는 platform_publish_dry_run_status='ready'인 것만 조회한다", async () => {
    const rows = [makeSocialPostRow({ platform_publish_dry_run_status: "ready" })];
    const chain = makeChain({ data: rows, error: null });
    const from = vi.fn(() => chain);
    createServerSupabaseClient.mockReturnValue({ from });

    const result = await listDryRunReadySocialPostsByArticle("article-1");

    expect(chain.eq).toHaveBeenCalledWith("platform_publish_dry_run_status", "ready");
    expect(result).toHaveLength(1);
  });

  it("listHandoffReadySocialPostsByArticle는 handoff_status='ready'인 것만 조회한다", async () => {
    const rows = [makeSocialPostRow({ handoff_status: "ready" })];
    const chain = makeChain({ data: rows, error: null });
    const from = vi.fn(() => chain);
    createServerSupabaseClient.mockReturnValue({ from });

    const result = await listHandoffReadySocialPostsByArticle("article-1");

    expect(chain.eq).toHaveBeenCalledWith("handoff_status", "ready");
    expect(result).toHaveLength(1);
  });
});

describe("manual posting result recording (Phase 3-8)", () => {
  it("updateManualPostingChecklist는 manual_post_status='ready_to_record'와 checklist를 저장한다", async () => {
    const row = makeSocialPostRow();
    const chain = makeChain({ data: row, error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    await updateManualPostingChecklist("social-post-1", [{ key: "k", label: "l", status: "pending" }]);

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ manual_post_status: "ready_to_record", manual_post_checklist: expect.any(Array) })
    );
  });

  it("updateManualPostingResult는 status='posted'+markPublished=true일 때 publish_status/post_url/published_at을 함께 갱신한다", async () => {
    const row = makeSocialPostRow();
    const chain = makeChain({ data: row, error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    await updateManualPostingResult("social-post-1", {
      status: "posted",
      manualPostUrl: "https://blog.naver.com/myid/1",
      manualPostedAt: "2026-02-01T00:00:00.000Z",
      markPublished: true,
    });

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        manual_post_status: "posted",
        manual_post_url: "https://blog.naver.com/myid/1",
        publish_status: "published",
        post_url: "https://blog.naver.com/myid/1",
        published_at: "2026-02-01T00:00:00.000Z",
      })
    );
  });

  it("updateManualPostingResult는 status='failed'일 때 publish_status를 건드리지 않는다", async () => {
    const row = makeSocialPostRow();
    const chain = makeChain({ data: row, error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    await updateManualPostingResult("social-post-1", { status: "failed", error: "실패 사유" });

    const call = (chain.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.manual_post_status).toBe("failed");
    expect(call.publish_status).toBeUndefined();
  });

  it("listManualPostingReadySocialPostsByArticle는 manual_post_status='ready_to_record'인 것만 조회한다", async () => {
    const rows = [makeSocialPostRow({ manual_post_status: "ready_to_record" })];
    const chain = makeChain({ data: rows, error: null });
    const from = vi.fn(() => chain);
    createServerSupabaseClient.mockReturnValue({ from });

    const result = await listManualPostingReadySocialPostsByArticle("article-1");

    expect(chain.eq).toHaveBeenCalledWith("manual_post_status", "ready_to_record");
    expect(result).toHaveLength(1);
  });

  it("listManualPostedSocialPostsByArticle는 manual_post_status='posted'인 것만 조회한다", async () => {
    const rows = [makeSocialPostRow({ manual_post_status: "posted" })];
    const chain = makeChain({ data: rows, error: null });
    const from = vi.fn(() => chain);
    createServerSupabaseClient.mockReturnValue({ from });

    const result = await listManualPostedSocialPostsByArticle("article-1");

    expect(chain.eq).toHaveBeenCalledWith("manual_post_status", "posted");
    expect(result).toHaveLength(1);
  });
});

describe("rewrite versioning (Phase 3-11)", () => {
  it("createRewriteVersion은 parent/root/version_number를 포함해 새 row를 insert한다", async () => {
    const row = makeSocialPostRow({ id: "social-post-2", version_number: 2, is_rewrite_version: true });
    const chain = makeChain({ data: row, error: null });
    const from = vi.fn(() => chain);
    createServerSupabaseClient.mockReturnValue({ from });

    const result = await createRewriteVersion({
      articleId: "article-1",
      platform: "naver_blog",
      toneStyle: "informational",
      postTitle: "새 제목",
      parentSocialPostId: "social-post-1",
      rootSocialPostId: "social-post-1",
      versionNumber: 2,
    });

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        parent_social_post_id: "social-post-1",
        root_social_post_id: "social-post-1",
        version_number: 2,
        is_rewrite_version: true,
      })
    );
    expect(result.id).toBe("social-post-2");
  });

  it("updateSocialPostVersionStatus는 version_status만 갱신한다", async () => {
    const chain = makeChain({ data: makeSocialPostRow({ version_status: "superseded" }), error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    await updateSocialPostVersionStatus("social-post-1", "superseded");

    expect(chain.update).toHaveBeenCalledWith({ version_status: "superseded" });
  });

  it("listRewriteVersionsByArticle는 is_rewrite_version=true인 것만 조회한다", async () => {
    const rows = [makeSocialPostRow({ is_rewrite_version: true })];
    const chain = makeChain({ data: rows, error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const result = await listRewriteVersionsByArticle("article-1");

    expect(chain.eq).toHaveBeenCalledWith("is_rewrite_version", true);
    expect(result).toHaveLength(1);
  });

  it("listRewriteVersionsByRoot는 root_social_post_id 기준으로 버전 순 조회한다", async () => {
    const rows = [makeSocialPostRow({ version_number: 1 }), makeSocialPostRow({ id: "social-post-2", version_number: 2 })];
    const chain = makeChain({ data: rows, error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const result = await listRewriteVersionsByRoot("social-post-1");

    expect(chain.eq).toHaveBeenCalledWith("root_social_post_id", "social-post-1");
    expect(result).toHaveLength(2);
  });
});

describe("version comparison (Phase 3-12)", () => {
  it("getSocialPostForVersionComparison은 social post를 조회한다", async () => {
    const chain = makeChain({ data: makeSocialPostRow(), error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const result = await getSocialPostForVersionComparison("social-post-1");

    expect(result?.id).toBe("social-post-1");
  });

  it("updateVersionComparisonSummary는 latest_version_comparison_id/version_comparison_status를 저장한다", async () => {
    const chain = makeChain({ data: makeSocialPostRow({ version_comparison_status: "rewrite_better" }), error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    await updateVersionComparisonSummary("social-post-2", {
      latestVersionComparisonId: "comparison-1",
      versionComparisonStatus: "rewrite_better",
      versionComparisonScore: 90,
      recommendedForRepost: true,
    });

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ latest_version_comparison_id: "comparison-1", version_comparison_status: "rewrite_better", recommended_for_repost: true })
    );
  });

  it("listRewriteVersionsNeedingComparison은 not_compared인 rewrite version만 조회한다", async () => {
    const rows = [makeSocialPostRow({ is_rewrite_version: true, version_comparison_status: "not_compared" })];
    const chain = makeChain({ data: rows, error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const result = await listRewriteVersionsNeedingComparison("article-1");

    expect(chain.eq).toHaveBeenCalledWith("version_comparison_status", "not_compared");
    expect(result).toHaveLength(1);
  });

  it("listRecommendedRewriteVersions는 recommended_for_repost=true인 것만 조회한다", async () => {
    const rows = [makeSocialPostRow({ recommended_for_repost: true })];
    const chain = makeChain({ data: rows, error: null });
    createServerSupabaseClient.mockReturnValue({ from: vi.fn(() => chain) });

    const result = await listRecommendedRewriteVersions("article-1");

    expect(chain.eq).toHaveBeenCalledWith("recommended_for_repost", true);
    expect(result).toHaveLength(1);
  });
});
