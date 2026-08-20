// wordpress_blog 글 카드의 "SEO Plugin Metadata" 섹션이 사용하는 서비스.
// article의 "SEO Plugin Actual Write"(Phase 2-12/2-13,
// lib/seo/seo-plugin-actual-write-service.ts)와 같은 실제 WordPress
// 호출 코드(lib/publish/wordpress-client.ts의 updateSeoPluginMetadata/
// verifySeoPluginMetadata, lib/seo/wordpress-seo-custom-endpoint-client.ts의
// updateRankMathSeoViaCustomEndpoint)를 그대로 재사용한다 — 새로운 실제
// API 호출 코드를 추가하지 않는다.
//
// 중요한 구조적 사실(문서에도 기록): 이 프로젝트는 article 1개당
// WordPress post 1개만 만드는 구조다(Phase 2 설계, publish_logs가
// articleId 기준으로 dedup한다). wordpress_blog social_post는 별도의
// WordPress post를 갖지 않고, article과 **같은** WordPress post를
// 대상으로 SEO metadata를 반영한다 — 이미 WordPress Draft 생성이
// wordpress_blog의 title/body로 그 post의 내용을 덮어쓰는 것과 같은
// 전제다(contentOverride 패턴). 다만 "어떤 값을 보낼지"와 "결과를 어디에
// 기록할지"는 완전히 분리한다 — article의 seo_plugin_write_status 등
// article 컬럼(saveSeoPluginActualWriteResult)은 절대 건드리지 않고,
// wordpress_blog 자신의 write 결과는 social_posts.platformMetadata.
// seoPluginWrite에만 저장한다. 그래서 article 페이지의 "SEO Plugin
// Actual Write" 표시와 wordpress_blog 카드의 표시가 서로 덮어쓰지 않는다.

import { getArticleById } from "@/lib/repositories/article-repository";
import { getSocialPostById, updateSocialPostContent } from "@/lib/repositories/social-posts-repository";
import { getSuccessfulWordPressDraft, savePublishLog } from "@/lib/repositories/publish-repository";
import { updateSeoPluginMetadata, verifySeoPluginMetadata } from "@/lib/publish/wordpress-client";
import type { SeoPluginWriteProvider } from "@/lib/publish/wordpress-client";
import {
  updateRankMathSeoViaCustomEndpoint,
  isSeoCustomEndpointEnabled,
} from "@/lib/seo/wordpress-seo-custom-endpoint-client";
import { isSeoPluginWriteEnabled } from "@/lib/seo/seo-plugin-config";
import { checkWordPressBlogPublishReadiness } from "./wordpress-blog-publish-readiness";
import { logEvent } from "@/lib/harness/logger";

export const WORDPRESS_BLOG_SEO_PLUGIN_TARGET = "wordpress_blog_seo_plugin";

export const WORDPRESS_BLOG_SEO_PLUGIN_PROVIDERS: readonly { value: string; label: string }[] = [
  { value: "none", label: "사용 안 함" },
  { value: "rank_math", label: "Rank Math" },
  { value: "yoast", label: "Yoast SEO" },
  { value: "aioseo", label: "AIOSEO" },
  { value: "custom_endpoint", label: "Custom Endpoint" },
];

type WordPressBlogSeoPluginProvider = "none" | "rank_math" | "yoast" | "aioseo" | "custom_endpoint";

function isWordPressBlogSeoPluginProvider(value: unknown): value is WordPressBlogSeoPluginProvider {
  return value === "none" || value === "rank_math" || value === "yoast" || value === "aioseo" || value === "custom_endpoint";
}

export interface WriteWordPressBlogSeoPluginMetadataResult {
  success: boolean;
  message: string;
  /** provider=none 등 의도적으로 건너뛴 경우 true. 실패와 구분한다. */
  skipped?: boolean;
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readStringArray(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/**
 * platformMetadata에 provider 선택을 저장한다(실제 write는 하지 않음).
 * 사용자가 select만 바꾸고 아직 반영 버튼을 누르지 않은 상태도 기억해 둔다.
 */
export async function saveWordPressBlogSeoPluginProvider(
  socialPostId: string,
  providerInput: unknown
): Promise<{ success: boolean; message: string }> {
  const post = await getSocialPostById(socialPostId);
  if (!post) {
    return { success: false, message: `블로그 글을 찾을 수 없습니다: ${socialPostId}` };
  }
  if (post.platform !== "wordpress_blog") {
    return { success: false, message: `이 기능은 wordpress_blog 글에서만 사용할 수 있습니다 (현재 platform: ${post.platform}).` };
  }
  if (!isWordPressBlogSeoPluginProvider(providerInput)) {
    return { success: false, message: "지원하지 않는 SEO Plugin provider입니다." };
  }

  const existingMetadata = post.platformMetadata ?? {};
  await updateSocialPostContent(socialPostId, {
    platformMetadata: { ...existingMetadata, seoPluginProvider: providerInput },
  });

  return { success: true, message: `SEO Plugin provider를 ${providerInput}(으)로 저장했습니다.` };
}

/**
 * wordpress_blog 자신의 seoTitle/metaDescription/targetKeyword/
 * secondaryKeywords(platformMetadata 전용, article fallback 없음)를
 * 실제 WordPress SEO plugin(rank_math/yoast/aioseo) 또는 custom
 * endpoint를 통해 반영한다. article과 같은 WordPress post를 대상으로
 * 하지만, 결과는 social_posts.platformMetadata.seoPluginWrite에만
 * 저장한다(article 컬럼 미사용).
 */
export async function writeWordPressBlogSeoPluginMetadata(
  articleId: string,
  socialPostId: string,
  providerInput?: unknown
): Promise<WriteWordPressBlogSeoPluginMetadataResult> {
  const post = await getSocialPostById(socialPostId);
  if (!post) {
    return { success: false, message: `블로그 글을 찾을 수 없습니다: ${socialPostId}` };
  }
  if (post.platform !== "wordpress_blog") {
    return { success: false, message: `이 기능은 wordpress_blog 글에서만 사용할 수 있습니다 (현재 platform: ${post.platform}).` };
  }

  const readiness = checkWordPressBlogPublishReadiness(post);
  if (!readiness.ready) {
    return { success: false, message: `SEO Plugin metadata 반영이 차단되었습니다: ${readiness.blockers.join(" / ")}` };
  }

  const platformMetadata = post.platformMetadata ?? {};
  const provider: WordPressBlogSeoPluginProvider = isWordPressBlogSeoPluginProvider(providerInput)
    ? providerInput
    : isWordPressBlogSeoPluginProvider(platformMetadata.seoPluginProvider)
      ? (platformMetadata.seoPluginProvider as WordPressBlogSeoPluginProvider)
      : "none";

  const article = await getArticleById(articleId);

  async function saveWriteResult(status: string, extra: Record<string, unknown> = {}): Promise<void> {
    const current = post!.platformMetadata ?? {};
    await updateSocialPostContent(socialPostId, {
      platformMetadata: {
        ...current,
        seoPluginProvider: provider,
        seoPluginWrite: {
          status,
          provider,
          updatedAt: new Date().toISOString(),
          errorMessage: null,
          ...extra,
        },
      },
    });
  }

  if (provider === "none") {
    await saveWriteResult("skipped_provider_none");
    return { success: true, skipped: true, message: "SEO Plugin provider가 '사용 안 함'이어서 반영을 건너뜁니다." };
  }

  const blogSeoTitle = readString(platformMetadata, "seoTitle");
  const blogMetaDescription = readString(platformMetadata, "metaDescription");
  const blogTargetKeyword = readString(platformMetadata, "targetKeyword");
  const blogSecondaryKeywords = readStringArray(platformMetadata, "secondaryKeywords");

  if (!blogTargetKeyword) {
    const message =
      "wordpress_blog 글에 targetKeyword가 없어 SEO Plugin에 반영할 수 없습니다. " +
      "\"SEO Metadata 재생성\"으로 wordpress_blog 글 자체의 metadata를 먼저 만드세요.";
    await saveWriteResult("skipped_missing_target_keyword");
    return { success: false, message };
  }

  const existingDraft = await getSuccessfulWordPressDraft(articleId);
  if (!existingDraft) {
    const message = "WordPress Draft post가 없습니다. 먼저 WordPress Draft를 생성하세요.";
    await saveWriteResult("skipped_no_wordpress_post");
    return { success: false, message };
  }
  const postId = Number(existingDraft.externalPostId);
  if (!Number.isInteger(postId) || postId <= 0) {
    const message = "기존 WordPress draft의 post id가 유효하지 않습니다.";
    await saveWriteResult("failed", { errorMessage: message });
    return { success: false, message };
  }

  await logEvent({
    type: "wordpress_blog_seo_plugin_write_completed",
    status: "info",
    message: `wordpress_blog 글(${socialPostId})의 SEO Plugin(${provider}) metadata 반영을 시작합니다.`,
    details: { socialPostId, provider, postId },
    articleId,
    themeId: article?.themeId,
    targetType: "article",
    targetId: articleId,
  });

  // custom_endpoint는 Rank Math 전용 REST endpoint를 통해 반영한다(Phase 2-13과 동일 경로).
  if (provider === "custom_endpoint") {
    if (!isSeoCustomEndpointEnabled()) {
      const message = "WORDPRESS_SEO_CUSTOM_ENDPOINT_ENABLED=false이어서 custom endpoint 반영을 건너뜁니다.";
      await saveWriteResult("skipped_disabled");
      return { success: false, skipped: true, message };
    }

    const result = await updateRankMathSeoViaCustomEndpoint({
      postId,
      seoTitle: blogSeoTitle ?? undefined,
      metaDescription: blogMetaDescription ?? undefined,
      focusKeyword: blogTargetKeyword,
      secondaryKeywords: blogSecondaryKeywords,
    });

    if (!result.success) {
      await saveWriteResult("failed", { errorMessage: result.errorMessage });
      await savePublishLog({
        articleId,
        target: WORDPRESS_BLOG_SEO_PLUGIN_TARGET,
        status: "failed",
        errorMessage: result.errorMessage,
        details: { actual: true, socialPostId, provider: "custom_endpoint", postId },
      });
      return { success: false, message: result.errorMessage };
    }

    await saveWriteResult("success", { verified: result.verified });
    await savePublishLog({
      articleId,
      target: WORDPRESS_BLOG_SEO_PLUGIN_TARGET,
      status: "success",
      externalPostId: String(postId),
      postUrl: existingDraft.postUrl ?? undefined,
      details: { actual: true, socialPostId, provider: "custom_endpoint", postId, verified: result.verified },
    });
    return { success: true, message: "wordpress_blog 글의 SEO metadata를 custom endpoint로 반영했습니다." };
  }

  // rank_math/yoast/aioseo: 표준 REST posts meta update 경로.
  if (!isSeoPluginWriteEnabled()) {
    const message = `SEO_PLUGIN_WRITE_ENABLED=false이어서 실제 SEO plugin(${provider}) write를 건너뜁니다 (dry-run).`;
    await saveWriteResult("skipped_disabled");
    return { success: false, skipped: true, message };
  }

  const fields = {
    seoTitle: blogSeoTitle ?? undefined,
    metaDescription: blogMetaDescription ?? undefined,
    focusKeyword: blogTargetKeyword,
  };
  const providerForWrite: SeoPluginWriteProvider = provider;

  const writeResult = await updateSeoPluginMetadata(postId, providerForWrite, fields);
  if (!writeResult.success) {
    await saveWriteResult("failed", { errorMessage: writeResult.errorMessage });
    await savePublishLog({
      articleId,
      target: WORDPRESS_BLOG_SEO_PLUGIN_TARGET,
      status: "failed",
      errorMessage: writeResult.errorMessage,
      details: { actual: true, socialPostId, provider, postId, statusCode: writeResult.statusCode ?? null },
    });
    return { success: false, message: writeResult.errorMessage };
  }

  const verification = await verifySeoPluginMetadata(postId, writeResult.fieldsAttempted);
  await saveWriteResult(verification.verified ? "success" : "needs_custom_endpoint", {
    verified: verification.verified,
    warning: verification.warning ?? null,
  });
  await savePublishLog({
    articleId,
    target: WORDPRESS_BLOG_SEO_PLUGIN_TARGET,
    status: "success",
    externalPostId: String(postId),
    postUrl: existingDraft.postUrl ?? undefined,
    details: {
      actual: true,
      socialPostId,
      provider,
      postId,
      fieldsAttempted: writeResult.fieldsAttempted,
      verified: verification.verified,
    },
  });

  return {
    success: true,
    message: verification.verified
      ? "wordpress_blog 글의 SEO plugin metadata를 실제로 반영했습니다."
      : "SEO plugin metadata write 요청은 성공했지만 반영 여부는 확인되지 않았습니다 (custom endpoint가 필요할 수 있습니다).",
  };
}
