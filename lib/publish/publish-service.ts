// Phase 2-2: WordPress Draft Publish 서비스.
// reviewed 상태이고 사람이 승인한(approval_logs 존재) article만 WordPress에
// status="draft"인 post로 생성한다. 자동 공개(publish)는 절대 수행하지 않는다.
// WORDPRESS_PUBLISH_ENABLED=false이면 실제 API를 호출하지 않고 dry-run으로 처리한다.

import { getArticleById, updateSeoPluginWriteStatus } from "@/lib/repositories/article-repository";
import { getApprovalLogsByArticleId } from "@/lib/repositories/approval-repository";
import { savePublishLog, hasSuccessfulPublishLog } from "@/lib/repositories/publish-repository";
import { createDraftPost, findOrCreateCategory, findOrCreateTag } from "./wordpress-client";
import { applySeoPluginMetadata } from "@/lib/seo/seo-plugin-writer";
import { resolveExistingFeaturedMediaId } from "@/lib/images/featured-image-uploader";
import { logEvent } from "@/lib/harness/logger";
import type { Article } from "@/lib/types/domain";
import type { SeoPluginPayload } from "@/lib/seo/seo-plugin-types";

/**
 * article에 이미 WordPress media id가 저장되어 있으면 그대로 사용하고, 없으면
 * undefined를 반환한다 (Phase 2-5). 실제 이미지 생성/업로드는 아직 구현하지
 * 않았으므로 현재는 항상 skip 이벤트를 기록하고 undefined를 반환한다.
 */
async function resolveFeaturedMediaForPublish(articleId: string, article: Article): Promise<number | undefined> {
  const mediaId = resolveExistingFeaturedMediaId(article);
  if (mediaId !== undefined) {
    await logEvent({
      type: "wordpress_featured_media_prepared",
      status: "info",
      message: `기사(${articleId})의 featured_media(${mediaId})를 WordPress post에 연결합니다.`,
      articleId,
      themeId: article.themeId,
      targetType: "article",
      targetId: articleId,
    });
    return mediaId;
  }

  await logEvent({
    type: "featured_image_upload_skipped_not_implemented",
    status: "info",
    message: `기사(${articleId})의 대표 이미지 업로드는 아직 구현되지 않아 건너뜁니다.`,
    articleId,
    themeId: article.themeId,
    targetType: "article",
    targetId: articleId,
  });
  await logEvent({
    type: "wordpress_featured_image_skipped_no_media",
    status: "info",
    message: `기사(${articleId})에 WordPress media id가 없어 featured_media를 설정하지 않습니다.`,
    articleId,
    themeId: article.themeId,
    targetType: "article",
    targetId: articleId,
  });
  await logEvent({
    type: "wordpress_featured_media_skipped_no_media_id",
    status: "info",
    message: `기사(${articleId})에 WordPress media id가 없어 featured_media 연결을 건너뜁니다 (Phase 2-6).`,
    articleId,
    themeId: article.themeId,
    targetType: "article",
    targetId: articleId,
  });
  return undefined;
}

/**
 * WordPress draft post 생성 성공 후 SEO plugin metadata write를 시도한다 (Phase 2-4).
 * provider=none이면 write 대상이 없어 즉시 skipped_provider_none으로 기록하고,
 * SEO_PLUGIN_WRITE_ENABLED=false이거나 WORDPRESS_PUBLISH_ENABLED가 아니면
 * skipped_dry_run으로 기록한다 (lib/seo/seo-plugin-writer.ts의 safe stub 참고).
 */
async function handleSeoPluginWrite(articleId: string, article: Article, postId: string): Promise<void> {
  const provider = article.seoPluginProvider;

  if (provider === "none") {
    await updateSeoPluginWriteStatus(articleId, "skipped_provider_none");
    await logEvent({
      type: "seo_plugin_write_skipped_provider_none",
      status: "info",
      message: `기사(${articleId})는 SEO plugin provider가 none이어서 metadata write를 건너뜁니다.`,
      articleId,
      themeId: article.themeId,
      targetType: "article",
      targetId: articleId,
    });
    return;
  }

  await logEvent({
    type: "seo_plugin_write_started",
    status: "info",
    message: `기사(${articleId})의 SEO plugin(${provider}) metadata write를 시작합니다.`,
    articleId,
    themeId: article.themeId,
    targetType: "article",
    targetId: articleId,
  });

  const result = await applySeoPluginMetadata(postId, provider, article.seoPluginPayload as unknown as SeoPluginPayload);

  if (result.status === "success") {
    await updateSeoPluginWriteStatus(articleId, "success");
    await logEvent({
      type: "seo_plugin_write_completed",
      status: "success",
      message: `기사(${articleId})의 SEO plugin(${provider}) metadata write를 완료했습니다.`,
      articleId,
      themeId: article.themeId,
      targetType: "article",
      targetId: articleId,
    });
  } else if (result.status === "skipped_dry_run") {
    await updateSeoPluginWriteStatus(articleId, "skipped_dry_run");
    await logEvent({
      type: "seo_plugin_write_skipped_dry_run",
      status: "info",
      message: `SEO_PLUGIN_WRITE_ENABLED=false 또는 dry-run 모드이므로 기사(${articleId})의 SEO plugin metadata write를 건너뜁니다.`,
      articleId,
      themeId: article.themeId,
      targetType: "article",
      targetId: articleId,
    });
  } else {
    await updateSeoPluginWriteStatus(articleId, "failed", result.errorMessage);
    await logEvent({
      type: "seo_plugin_write_failed",
      status: "failed",
      message: `SEO plugin metadata write 실패: ${result.errorMessage}`,
      articleId,
      themeId: article.themeId,
      targetType: "article",
      targetId: articleId,
    });
  }
}

interface ResolvedWordPressTerms {
  categoryIds: number[];
  tagIds: number[];
}

/**
 * article의 wp_category_ids/wp_tag_ids가 이미 있으면 그대로 사용하고,
 * 없고 이름(wp_category_names/wp_tag_names)만 있으면 WordPress에서 이름으로
 * 찾거나 새로 생성해 id를 얻는다 (Phase 2-3). WORDPRESS_PUBLISH_ENABLED=true일
 * 때만 호출된다 — dry-run에서는 이 함수 자체가 호출되지 않는다.
 */
async function resolveWordPressTerms(articleId: string, article: Article): Promise<ResolvedWordPressTerms> {
  if (article.wpCategoryIds.length === 0 && article.wpTagIds.length === 0) {
    if (article.wpCategoryNames.length === 0 && article.wpTagNames.length === 0) {
      return { categoryIds: [], tagIds: [] };
    }
  }

  let categoryIds = [...article.wpCategoryIds];
  let tagIds = [...article.wpTagIds];

  const needsCategorySync = categoryIds.length === 0 && article.wpCategoryNames.length > 0;
  const needsTagSync = tagIds.length === 0 && article.wpTagNames.length > 0;

  if (!needsCategorySync && !needsTagSync) {
    return { categoryIds, tagIds };
  }

  await logEvent({
    type: "wordpress_category_tag_sync_started",
    status: "info",
    message: `기사(${articleId})의 WordPress 카테고리/태그 동기화를 시작합니다.`,
    articleId,
    themeId: article.themeId,
    targetType: "article",
    targetId: articleId,
  });

  try {
    if (needsCategorySync) {
      const results = await Promise.all(article.wpCategoryNames.map((name) => findOrCreateCategory(name)));
      categoryIds = results.filter((r) => r.success).map((r) => r.id);
    }
    if (needsTagSync) {
      const results = await Promise.all(article.wpTagNames.map((name) => findOrCreateTag(name)));
      tagIds = results.filter((r) => r.success).map((r) => r.id);
    }

    await logEvent({
      type: "wordpress_category_tag_sync_completed",
      status: "success",
      message: `기사(${articleId})의 WordPress 카테고리/태그 동기화를 완료했습니다.`,
      articleId,
      themeId: article.themeId,
      targetType: "article",
      targetId: articleId,
      details: { categoryIds, tagIds },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    await logEvent({
      type: "wordpress_category_tag_sync_failed",
      status: "failed",
      message: `WordPress 카테고리/태그 동기화 실패: ${message}. 카테고리/태그 없이 게시를 계속합니다.`,
      articleId,
      themeId: article.themeId,
      targetType: "article",
      targetId: articleId,
      details: { error: message },
    });
    // 동기화 실패는 게시 자체를 막지 않는다 — 카테고리/태그 없이 draft를 생성한다.
  }

  return { categoryIds, tagIds };
}

export const WORDPRESS_TARGET = "wordpress";

export interface PublishResult {
  success: boolean;
  dryRun: boolean;
  message: string;
  postUrl?: string;
  externalPostId?: string;
}

/** WORDPRESS_PUBLISH_ENABLED=true일 때만 실제 WordPress API를 호출한다. */
export function isWordPressPublishEnabled(): boolean {
  return process.env.WORDPRESS_PUBLISH_ENABLED === "true";
}

/**
 * article_mode별 WordPress 전송 제목을 결정한다.
 * monetized_blog: seo_title이 있으면 우선 사용, 없으면 article.title.
 * 그 외 모드: article.title.
 */
export function resolveWordPressTitle(article: Article): string {
  if (article.articleMode === "monetized_blog" && article.seoTitle) {
    return article.seoTitle;
  }
  return article.title;
}

const EXCERPT_MAX_LENGTH = 160;

/**
 * WordPress excerpt를 결정한다. meta_description이 있으면 그대로 사용하고,
 * 없으면 본문(AD_SLOT marker 제외) 앞부분에서 안전하게 생성한다.
 */
export function resolveWordPressExcerpt(article: Article): string | undefined {
  if (article.metaDescription) return article.metaDescription;

  const plainText = article.content
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/[#*_>`|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!plainText) return undefined;

  return plainText.length > EXCERPT_MAX_LENGTH
    ? `${plainText.slice(0, EXCERPT_MAX_LENGTH)}…`
    : plainText;
}

/**
 * reviewed 상태의 article을 WordPress에 draft post로 생성한다.
 *
 * 순서: article 조회 → status=reviewed 확인 → content 비어있지 않은지 확인 →
 * approval_logs 존재 확인 → 기존 success publish_logs 존재 확인(중복 방지) →
 * dry-run 또는 실제 WordPress API 호출 → publish_logs 저장 → pipeline_logs 기록.
 */
export async function publishArticleToWordPressDraft(articleId: string): Promise<PublishResult> {
  const article = await getArticleById(articleId);

  if (!article) {
    return { success: false, dryRun: false, message: `기사를 찾을 수 없습니다: ${articleId}` };
  }

  if (article.status !== "reviewed") {
    await logEvent({
      type: "wordpress_publish_skipped_not_reviewed",
      status: "failed",
      message: `기사(${articleId})는 reviewed 상태가 아니어서 WordPress 게시를 건너뜁니다 (status=${article.status}).`,
      articleId,
      themeId: article.themeId,
      targetType: "article",
      targetId: articleId,
    });
    return {
      success: false,
      dryRun: false,
      message: "승인(reviewed)된 기사만 WordPress에 게시할 수 있습니다.",
    };
  }

  if (!article.content.trim()) {
    return { success: false, dryRun: false, message: "기사 본문이 비어 있어 게시할 수 없습니다." };
  }

  const approvalLogs = await getApprovalLogsByArticleId(articleId, 1);
  if (approvalLogs.length === 0) {
    await logEvent({
      type: "wordpress_publish_skipped_not_reviewed",
      status: "failed",
      message: `기사(${articleId})의 승인 기록(approval_logs)이 없어 WordPress 게시를 건너뜁니다.`,
      articleId,
      themeId: article.themeId,
      targetType: "article",
      targetId: articleId,
    });
    return { success: false, dryRun: false, message: "승인 기록이 없어 게시할 수 없습니다." };
  }

  const alreadyPublished = await hasSuccessfulPublishLog(articleId, WORDPRESS_TARGET);
  if (alreadyPublished) {
    await logEvent({
      type: "wordpress_publish_skipped_duplicate",
      status: "info",
      message: `기사(${articleId})는 이미 WordPress에 초안이 생성되어 있어 중복 생성을 건너뜁니다.`,
      articleId,
      themeId: article.themeId,
      targetType: "article",
      targetId: articleId,
    });
    return { success: true, dryRun: false, message: "이미 WordPress 초안이 생성되어 있습니다." };
  }

  const title = resolveWordPressTitle(article);
  const excerpt = resolveWordPressExcerpt(article);

  await logEvent({
    type: "wordpress_publish_started",
    status: "info",
    message: `기사(${articleId}) WordPress 초안 생성을 시작합니다.`,
    articleId,
    themeId: article.themeId,
    targetType: "article",
    targetId: articleId,
  });

  if (!isWordPressPublishEnabled()) {
    await logEvent({
      type: "wordpress_category_tag_sync_skipped_dry_run",
      status: "info",
      message: `dry-run 모드이므로 기사(${articleId})의 WordPress 카테고리/태그 동기화를 건너뜁니다.`,
      articleId,
      themeId: article.themeId,
      targetType: "article",
      targetId: articleId,
    });

    await savePublishLog({
      articleId,
      target: WORDPRESS_TARGET,
      status: "dry_run",
      details: {
        title,
        articleId,
        articleMode: article.articleMode,
        wouldPublishTo: "wordpress",
        categoryNames: article.wpCategoryNames,
        tagNames: article.wpTagNames,
        seoPlugin: {
          provider: article.seoPluginProvider,
          metadataStatus: article.seoPluginMetadataStatus,
          seoTitle: (article.seoPluginPayload as { seoTitle?: string })?.seoTitle ?? null,
          focusKeyword: (article.seoPluginPayload as { focusKeyword?: string })?.focusKeyword ?? null,
        },
        featuredImage: {
          status: article.featuredImageStatus,
          altText: article.featuredImageAltText,
          caption: article.featuredImageCaption,
          style: article.featuredImageStyle,
          aspectRatio: article.featuredImageAspectRatio,
        },
        featuredImageUpload: {
          uploadStatus: article.featuredImageUploadStatus,
          sourceType: article.featuredImageSourceType,
          filename: article.featuredImageFilename,
          mimeType: article.featuredImageMimeType,
          altText: article.featuredImageAltText,
          caption: article.featuredImageCaption,
          shouldSetAsFeatured:
            (article.featuredImageUploadPayload as { shouldSetAsFeatured?: boolean })?.shouldSetAsFeatured ?? null,
          wordpressMediaId: article.featuredImageWordpressMediaId,
          wouldAttachAsFeatured: article.featuredImageWordpressMediaId != null,
        },
        generatedImage: {
          status: article.generatedImageStatus,
          provider: article.generatedImageProvider,
          model: article.generatedImageModel,
          imageUrl: article.generatedImageUrl,
          width: article.generatedImageWidth,
          height: article.generatedImageHeight,
          format: article.generatedImageFormat,
        },
      },
    });

    await logEvent({
      type: "wordpress_publish_dry_run",
      status: "success",
      message: `dry-run 완료: 실제 WordPress에는 생성되지 않았습니다 (기사 ${articleId}).`,
      articleId,
      themeId: article.themeId,
      targetType: "article",
      targetId: articleId,
    });

    return {
      success: true,
      dryRun: true,
      message: "dry-run 완료: 실제 WordPress에는 생성되지 않음",
    };
  }

  const { categoryIds, tagIds } = await resolveWordPressTerms(articleId, article);
  const featuredMedia = await resolveFeaturedMediaForPublish(articleId, article);

  const result = await createDraftPost({
    title,
    content: article.content,
    excerpt,
    slug: article.slug ?? undefined,
    categories: categoryIds.length > 0 ? categoryIds : undefined,
    tags: tagIds.length > 0 ? tagIds : undefined,
    featuredMedia,
  });

  if (!result.success) {
    await savePublishLog({
      articleId,
      target: WORDPRESS_TARGET,
      status: "failed",
      errorMessage: result.errorMessage,
      details: {
        statusCode: result.statusCode ?? null,
        statusText: result.statusText ?? null,
        responseBodyExcerpt: result.responseBodyExcerpt ?? null,
      },
    });

    await logEvent({
      type: "wordpress_publish_failed",
      status: "failed",
      message: `WordPress 초안 생성 실패: ${result.errorMessage}`,
      articleId,
      themeId: article.themeId,
      targetType: "article",
      targetId: articleId,
    });

    return { success: false, dryRun: false, message: result.errorMessage };
  }

  await savePublishLog({
    articleId,
    target: WORDPRESS_TARGET,
    status: "success",
    externalPostId: String(result.externalPostId),
    postUrl: result.postUrl,
    details: { raw: result.raw },
  });

  await logEvent({
    type: "wordpress_publish_completed",
    status: "success",
    message: `WordPress 초안 생성 완료: ${result.postUrl}`,
    articleId,
    themeId: article.themeId,
    targetType: "article",
    targetId: articleId,
  });

  await handleSeoPluginWrite(articleId, article, String(result.externalPostId));

  return {
    success: true,
    dryRun: false,
    message: "WordPress 초안이 생성되었습니다.",
    postUrl: result.postUrl,
    externalPostId: String(result.externalPostId),
  };
}
