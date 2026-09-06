import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getArticleById = vi.fn();
const getSocialPostById = vi.fn();
const updateSocialPostContent = vi.fn();
const getSuccessfulWordPressDraft = vi.fn();
const savePublishLog = vi.fn();
const updateSeoPluginMetadata = vi.fn();
const verifySeoPluginMetadata = vi.fn();
const updateRankMathSeoViaCustomEndpoint = vi.fn();
const isSeoCustomEndpointEnabled = vi.fn();
const isSeoPluginWriteEnabled = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/article-repository", () => ({
  getArticleById: (...args: unknown[]) => getArticleById(...args),
}));
vi.mock("@/lib/repositories/social-posts-repository", () => ({
  getSocialPostById: (...args: unknown[]) => getSocialPostById(...args),
  updateSocialPostContent: (...args: unknown[]) => updateSocialPostContent(...args),
}));
vi.mock("@/lib/repositories/publish-repository", () => ({
  getSuccessfulWordPressDraft: (...args: unknown[]) => getSuccessfulWordPressDraft(...args),
  savePublishLog: (...args: unknown[]) => savePublishLog(...args),
}));
vi.mock("@/lib/publish/wordpress-client", () => ({
  updateSeoPluginMetadata: (...args: unknown[]) => updateSeoPluginMetadata(...args),
  verifySeoPluginMetadata: (...args: unknown[]) => verifySeoPluginMetadata(...args),
}));
vi.mock("@/lib/seo/wordpress-seo-custom-endpoint-client", () => ({
  updateRankMathSeoViaCustomEndpoint: (...args: unknown[]) => updateRankMathSeoViaCustomEndpoint(...args),
  isSeoCustomEndpointEnabled: (...args: unknown[]) => isSeoCustomEndpointEnabled(...args),
}));
vi.mock("@/lib/seo/seo-plugin-config", () => ({
  isSeoPluginWriteEnabled: (...args: unknown[]) => isSeoPluginWriteEnabled(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { writeWordPressBlogSeoPluginMetadata, saveWordPressBlogSeoPluginProvider } = await import(
  "./wordpress-blog-seo-plugin-service"
);

function makePost(overrides: Record<string, unknown> = {}) {
  return {
    id: "post-1",
    platform: "wordpress_blog",
    qualityStatus: "ready",
    approvalStatus: "approved",
    postTitle: "제목",
    postBody: "본문입니다. 충분히 깁니다.",
    platformMetadata: {
      seoTitle: "블로그 SEO 제목",
      metaDescription: "블로그 메타 설명",
      targetKeyword: "블로그 키워드",
      secondaryKeywords: ["보조1"],
      seoPluginProvider: "rank_math",
    },
    ...overrides,
  };
}

beforeEach(() => {
  getArticleById.mockReset();
  getSocialPostById.mockReset();
  updateSocialPostContent.mockReset();
  getSuccessfulWordPressDraft.mockReset();
  savePublishLog.mockReset();
  updateSeoPluginMetadata.mockReset();
  verifySeoPluginMetadata.mockReset();
  updateRankMathSeoViaCustomEndpoint.mockReset();
  isSeoCustomEndpointEnabled.mockReset();
  isSeoPluginWriteEnabled.mockReset();
  logEvent.mockReset();

  getSocialPostById.mockResolvedValue(makePost());
  getArticleById.mockResolvedValue({ themeId: "theme-1" });
  updateSocialPostContent.mockResolvedValue({});
  getSuccessfulWordPressDraft.mockResolvedValue({ externalPostId: "42", postUrl: "https://example.com/?p=42" });
  isSeoPluginWriteEnabled.mockReturnValue(true);
  isSeoCustomEndpointEnabled.mockReturnValue(true);
  updateSeoPluginMetadata.mockResolvedValue({ success: true, fieldsAttempted: ["seo_title"] });
  verifySeoPluginMetadata.mockResolvedValue({ verified: true });
  updateRankMathSeoViaCustomEndpoint.mockResolvedValue({ success: true, postId: 42, updatedKeys: ["rank_math_title"], verified: true });
  savePublishLog.mockResolvedValue({});
});

describe("saveWordPressBlogSeoPluginProvider", () => {
  it("wordpress_blog 글의 platformMetadata에 provider 선택을 저장한다", async () => {
    const result = await saveWordPressBlogSeoPluginProvider("post-1", "yoast");
    expect(result.success).toBe(true);
    expect(updateSocialPostContent).toHaveBeenCalledWith(
      "post-1",
      expect.objectContaining({ platformMetadata: expect.objectContaining({ seoPluginProvider: "yoast" }) })
    );
  });

  it("허용되지 않은 provider는 차단한다", async () => {
    const result = await saveWordPressBlogSeoPluginProvider("post-1", "invalid");
    expect(result.success).toBe(false);
  });

  it("naver_blog에서는 차단한다", async () => {
    getSocialPostById.mockResolvedValue(makePost({ platform: "naver_blog" }));
    const result = await saveWordPressBlogSeoPluginProvider("post-1", "rank_math");
    expect(result.success).toBe(false);
    expect(updateSocialPostContent).not.toHaveBeenCalled();
  });
});

describe("writeWordPressBlogSeoPluginMetadata", () => {
  it("provider=rank_math면 updateSeoPluginMetadata를 wordpress_blog seoTitle/metaDescription/targetKeyword로 호출한다", async () => {
    const result = await writeWordPressBlogSeoPluginMetadata("article-1", "post-1", "rank_math");

    expect(result.success).toBe(true);
    expect(updateSeoPluginMetadata).toHaveBeenCalledWith(
      42,
      "rank_math",
      expect.objectContaining({
        seoTitle: "블로그 SEO 제목",
        metaDescription: "블로그 메타 설명",
        focusKeyword: "블로그 키워드",
      })
    );
  });

  it("article title/content를 사용하지 않는다 (getArticleById는 로그용으로만 조회, write에는 미사용)", async () => {
    await writeWordPressBlogSeoPluginMetadata("article-1", "post-1", "rank_math");
    const call = updateSeoPluginMetadata.mock.calls[0][2];
    expect(call.seoTitle).toBe("블로그 SEO 제목");
    expect(JSON.stringify(call)).not.toContain("article");
  });

  it("provider=none이면 skip 처리하고 write를 호출하지 않는다", async () => {
    getSocialPostById.mockResolvedValue(makePost({ platformMetadata: { ...makePost().platformMetadata, seoPluginProvider: "none" } }));
    const result = await writeWordPressBlogSeoPluginMetadata("article-1", "post-1");
    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
    expect(updateSeoPluginMetadata).not.toHaveBeenCalled();
  });

  it("provider=custom_endpoint면 updateRankMathSeoViaCustomEndpoint를 호출한다", async () => {
    const result = await writeWordPressBlogSeoPluginMetadata("article-1", "post-1", "custom_endpoint");
    expect(result.success).toBe(true);
    expect(updateRankMathSeoViaCustomEndpoint).toHaveBeenCalledWith(
      expect.objectContaining({ postId: 42, focusKeyword: "블로그 키워드" })
    );
    expect(updateSeoPluginMetadata).not.toHaveBeenCalled();
  });

  it("targetKeyword가 없으면 차단하고 재생성을 안내한다", async () => {
    getSocialPostById.mockResolvedValue(
      makePost({ platformMetadata: { seoTitle: "제목", metaDescription: "설명", seoPluginProvider: "rank_math" } })
    );
    const result = await writeWordPressBlogSeoPluginMetadata("article-1", "post-1", "rank_math");
    expect(result.success).toBe(false);
    expect(result.message).toContain("SEO Metadata 재생성");
    expect(updateSeoPluginMetadata).not.toHaveBeenCalled();
  });

  it("WordPress Draft가 없으면 차단한다", async () => {
    getSuccessfulWordPressDraft.mockResolvedValue(null);
    const result = await writeWordPressBlogSeoPluginMetadata("article-1", "post-1", "rank_math");
    expect(result.success).toBe(false);
    expect(updateSeoPluginMetadata).not.toHaveBeenCalled();
  });

  it("quality_status가 ready가 아니면 차단한다", async () => {
    getSocialPostById.mockResolvedValue(makePost({ qualityStatus: "needs_revision" }));
    const result = await writeWordPressBlogSeoPluginMetadata("article-1", "post-1", "rank_math");
    expect(result.success).toBe(false);
    expect(updateSeoPluginMetadata).not.toHaveBeenCalled();
  });

  it("platform이 wordpress_blog가 아니면 차단한다", async () => {
    getSocialPostById.mockResolvedValue(makePost({ platform: "naver_blog" }));
    const result = await writeWordPressBlogSeoPluginMetadata("article-1", "post-1", "rank_math");
    expect(result.success).toBe(false);
    expect(updateSeoPluginMetadata).not.toHaveBeenCalled();
  });

  it("결과를 social_posts.platformMetadata.seoPluginWrite에 저장하고 article 컬럼(saveSeoPluginActualWriteResult 등)은 사용하지 않는다", async () => {
    await writeWordPressBlogSeoPluginMetadata("article-1", "post-1", "rank_math");
    const call = updateSocialPostContent.mock.calls.find((c) => c[1]?.platformMetadata?.seoPluginWrite);
    expect(call).toBeTruthy();
    expect(call![1].platformMetadata.seoPluginWrite.status).toBe("success");
  });

  it("logs에는 Authorization/App Password/full content가 저장되지 않는다", async () => {
    await writeWordPressBlogSeoPluginMetadata("article-1", "post-1", "rank_math");
    const serialized = JSON.stringify([...logEvent.mock.calls, ...savePublishLog.mock.calls]).toLowerCase();
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("app_password");
    expect(serialized).not.toContain("본문입니다");
  });

  it("write 실패 시 실패로 저장하고 성공으로 표시하지 않는다", async () => {
    updateSeoPluginMetadata.mockResolvedValue({ success: false, errorMessage: "WordPress 인증 실패" });
    const result = await writeWordPressBlogSeoPluginMetadata("article-1", "post-1", "rank_math");
    expect(result.success).toBe(false);
    expect(result.message).toBe("WordPress 인증 실패");
  });

  describe("개인정보 false positive override", () => {
    function makePostWithPhoneLikeBody(manualSafetyReviewOverrides?: Record<string, unknown>) {
      return makePost({
        postBody: "문의처: 제주도청 주택토지과 064-710-4252로 연락하세요. 본문입니다. 충분히 깁니다.",
        platformMetadata: {
          ...makePost().platformMetadata,
          ...(manualSafetyReviewOverrides ? { manualSafetyReview: manualSafetyReviewOverrides } : {}),
        },
      });
    }

    it("개인정보 의심(금지 표현)만 유일한 차단 사유이고 confirmed_false_positive 기록이 없으면 차단하고 override하지 않는다", async () => {
      getSocialPostById.mockResolvedValue(makePostWithPhoneLikeBody());
      const result = await writeWordPressBlogSeoPluginMetadata("article-1", "post-1", "rank_math");

      expect(result.success).toBe(false);
      expect(result.blockers?.some((b) => b.includes("개인정보"))).toBe(true);
      expect(updateSeoPluginMetadata).not.toHaveBeenCalled();
    });

    it("approval_status가 approved가 아니면 confirmed_false_positive 기록이 있어도 override하지 않는다", async () => {
      const post = makePostWithPhoneLikeBody({
        prohibitedExpressionOverride: {
          status: "confirmed_false_positive",
          reason: "공공기관 대표번호입니다.",
          confirmedAt: new Date().toISOString(),
          confirmedBy: "user",
          items: [{ type: "phone_like_pattern", location: "post_body", maskedValue: "064-***-****" }],
          contentFingerprint: "irrelevant-because-approval-blocks-first",
        },
      });
      getSocialPostById.mockResolvedValue({ ...post, approvalStatus: "not_requested" });

      const result = await writeWordPressBlogSeoPluginMetadata("article-1", "post-1", "rank_math");
      expect(result.success).toBe(false);
      expect(updateSeoPluginMetadata).not.toHaveBeenCalled();
    });

    it("confirmed_false_positive 기록이 있고 지문이 일치하며 다른 차단 사유가 없으면 override로 반영에 성공한다", async () => {
      // 지문(contentFingerprint) 계산 로직을 테스트에서 재현하지 않기 위해,
      // 실제 서비스 함수(confirmWordPressBlogPersonalInfoFalsePositive)를 통해
      // override 레코드를 만든 뒤 그 결과를 다음 조회에 반영한다.
      const { confirmWordPressBlogPersonalInfoFalsePositive } = await import("./wordpress-blog-personal-info-review");

      const postBeforeConfirm = makePostWithPhoneLikeBody();
      getSocialPostById.mockResolvedValue(postBeforeConfirm);
      updateSocialPostContent.mockImplementation(async (_id: string, patch: Record<string, unknown>) => {
        return { ...postBeforeConfirm, ...patch };
      });

      const confirmResult = await confirmWordPressBlogPersonalInfoFalsePositive("post-1", {
        reason: "제주도청 공식 대표번호입니다.",
        confirmedBy: "tester",
      });
      expect(confirmResult.success).toBe(true);

      const savedPatch = updateSocialPostContent.mock.calls.at(-1)?.[1] as { platformMetadata: Record<string, unknown> };
      const postAfterConfirm = { ...postBeforeConfirm, platformMetadata: savedPatch.platformMetadata };
      getSocialPostById.mockResolvedValue(postAfterConfirm);

      const result = await writeWordPressBlogSeoPluginMetadata("article-1", "post-1", "rank_math");

      expect(result.success).toBe(true);
      expect(result.overrideApplied).toBe(true);
      expect(updateSeoPluginMetadata).toHaveBeenCalled();
    });

    it("override가 적용되면 wordpress_blog_safety_override_applied와 wordpress_blog_seo_metadata_update_allowed_with_override 로그를 남긴다", async () => {
      const { confirmWordPressBlogPersonalInfoFalsePositive } = await import("./wordpress-blog-personal-info-review");
      const postBeforeConfirm = makePostWithPhoneLikeBody();
      getSocialPostById.mockResolvedValue(postBeforeConfirm);
      updateSocialPostContent.mockImplementation(async (_id: string, patch: Record<string, unknown>) => ({
        ...postBeforeConfirm,
        ...patch,
      }));
      await confirmWordPressBlogPersonalInfoFalsePositive("post-1", { reason: "기관 번호", confirmedBy: "tester" });
      const savedPatch = updateSocialPostContent.mock.calls.at(-1)?.[1] as { platformMetadata: Record<string, unknown> };
      getSocialPostById.mockResolvedValue({ ...postBeforeConfirm, platformMetadata: savedPatch.platformMetadata });

      await writeWordPressBlogSeoPluginMetadata("article-1", "post-1", "rank_math");

      const loggedTypes = logEvent.mock.calls.map((c) => c[0]?.type);
      expect(loggedTypes).toContain("wordpress_blog_safety_override_applied");
      expect(loggedTypes).toContain("wordpress_blog_seo_metadata_update_allowed_with_override");
    });

    it("override 흐름을 포함해도 public publish 관련 코드를 전혀 호출하지 않는다(소스 정적 검사)", () => {
      const source = readFileSync(new URL("./wordpress-blog-seo-plugin-service.ts", import.meta.url), "utf-8");
      expect(source).not.toMatch(/publishArticleToWordPressDraft|publicPublish|public_publish/i);
    });

    it("실제 개인정보 원문(064-710-4252)이 로그에 저장되지 않는다", async () => {
      const { confirmWordPressBlogPersonalInfoFalsePositive } = await import("./wordpress-blog-personal-info-review");
      const postBeforeConfirm = makePostWithPhoneLikeBody();
      getSocialPostById.mockResolvedValue(postBeforeConfirm);
      updateSocialPostContent.mockImplementation(async (_id: string, patch: Record<string, unknown>) => ({
        ...postBeforeConfirm,
        ...patch,
      }));
      await confirmWordPressBlogPersonalInfoFalsePositive("post-1", { reason: "기관 번호", confirmedBy: "tester" });

      const serialized = JSON.stringify(logEvent.mock.calls);
      expect(serialized).not.toContain("064-710-4252");
    });
  });
});
