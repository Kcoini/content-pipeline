import { beforeEach, describe, expect, it, vi } from "vitest";

const getSocialPostById = vi.fn();
const updateSocialPostContent = vi.fn();
const logEvent = vi.fn();
const getArticleById = vi.fn();

vi.mock("@/lib/repositories/social-posts-repository", () => ({
  getSocialPostById: (...args: unknown[]) => getSocialPostById(...args),
  updateSocialPostContent: (...args: unknown[]) => updateSocialPostContent(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));
vi.mock("@/lib/repositories/article-repository", () => ({
  getArticleById: (...args: unknown[]) => getArticleById(...args),
}));

const { markManualChecklistItemConfirmed, CONFIRMABLE_MANUAL_CHECKLIST_ITEM_KEYS } = await import(
  "./manual-posting-checklist-confirmation-service"
);

function makePost(overrides: Record<string, unknown> = {}) {
  return {
    id: "post-1",
    platform: "wordpress_blog",
    platformMetadata: { seoTitle: "SEO 제목" },
    ...overrides,
  };
}

beforeEach(() => {
  getSocialPostById.mockReset();
  updateSocialPostContent.mockReset();
  logEvent.mockReset();
  getArticleById.mockReset();

  getSocialPostById.mockResolvedValue(makePost());
  updateSocialPostContent.mockResolvedValue({});
  getArticleById.mockResolvedValue({ themeId: "theme-1" });
});

describe("markManualChecklistItemConfirmed", () => {
  it("확인 가능한 항목(final_content_check)을 confirmed로 저장한다", async () => {
    const result = await markManualChecklistItemConfirmed("article-1", "post-1", "final_content_check", "local-user");

    expect(result.success).toBe(true);
    expect(updateSocialPostContent).toHaveBeenCalledWith(
      "post-1",
      expect.objectContaining({
        platformMetadata: expect.objectContaining({
          seoTitle: "SEO 제목",
          manualChecklistConfirmations: expect.objectContaining({
            final_content_check: expect.objectContaining({ confirmed: true, confirmedBy: "local-user" }),
          }),
        }),
      })
    );
  });

  it("기존 confirmation을 덮어쓰지 않고 병합한다", async () => {
    getSocialPostById.mockResolvedValue(
      makePost({
        platformMetadata: {
          manualChecklistConfirmations: {
            image_link_check: { confirmed: true, confirmedAt: "2026-01-01T00:00:00.000Z", confirmedBy: "local-user" },
          },
        },
      })
    );

    await markManualChecklistItemConfirmed("article-1", "post-1", "wordpress_seo_check", "local-user");

    const call = updateSocialPostContent.mock.calls[0][1];
    expect(call.platformMetadata.manualChecklistConfirmations.image_link_check.confirmed).toBe(true);
    expect(call.platformMetadata.manualChecklistConfirmations.wordpress_seo_check.confirmed).toBe(true);
  });

  it("platform이 wordpress_blog가 아니면 차단한다", async () => {
    getSocialPostById.mockResolvedValue(makePost({ platform: "naver_blog" }));

    const result = await markManualChecklistItemConfirmed("article-1", "post-1", "final_content_check", "local-user");

    expect(result.success).toBe(false);
    expect(updateSocialPostContent).not.toHaveBeenCalled();
  });

  it("시스템 자동 계산 항목(quality_gate_ready)은 확인 완료로 표시할 수 없다", async () => {
    const result = await markManualChecklistItemConfirmed("article-1", "post-1", "quality_gate_ready", "local-user");

    expect(result.success).toBe(false);
    expect(updateSocialPostContent).not.toHaveBeenCalled();
  });

  it("URL 기반 항목(record_url_after_posting)은 확인 완료로 표시할 수 없다 (URL 입력으로 처리)", async () => {
    const result = await markManualChecklistItemConfirmed("article-1", "post-1", "record_url_after_posting", "local-user");

    expect(result.success).toBe(false);
    expect(updateSocialPostContent).not.toHaveBeenCalled();
  });

  it("social post를 찾을 수 없으면 차단한다", async () => {
    getSocialPostById.mockResolvedValue(null);

    const result = await markManualChecklistItemConfirmed("article-1", "post-1", "final_content_check", "local-user");

    expect(result.success).toBe(false);
  });

  it("CONFIRMABLE_MANUAL_CHECKLIST_ITEM_KEYS는 사람이 직접 확인하는 7개 항목을 포함한다", () => {
    expect(CONFIRMABLE_MANUAL_CHECKLIST_ITEM_KEYS.size).toBe(7);
    expect(CONFIRMABLE_MANUAL_CHECKLIST_ITEM_KEYS.has("final_content_check")).toBe(true);
    expect(CONFIRMABLE_MANUAL_CHECKLIST_ITEM_KEYS.has("wordpress_seo_check")).toBe(true);
    expect(CONFIRMABLE_MANUAL_CHECKLIST_ITEM_KEYS.has("quality_gate_ready")).toBe(false);
  });
});
