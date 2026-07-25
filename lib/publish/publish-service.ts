// Phase 2-2: WordPress Draft Publish 서비스.
// reviewed 상태이고 사람이 승인한(approval_logs 존재) article만 WordPress에
// status="draft"인 post로 생성한다. 자동 공개(publish)는 절대 수행하지 않는다.
// WORDPRESS_PUBLISH_ENABLED=false이면 실제 API를 호출하지 않고 dry-run으로 처리한다.

import { getArticleById } from "@/lib/repositories/article-repository";
import { getApprovalLogsByArticleId } from "@/lib/repositories/approval-repository";
import { savePublishLog, hasSuccessfulPublishLog } from "@/lib/repositories/publish-repository";
import { createDraftPost } from "./wordpress-client";
import { logEvent } from "@/lib/harness/logger";
import type { Article } from "@/lib/types/domain";

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
    await savePublishLog({
      articleId,
      target: WORDPRESS_TARGET,
      status: "dry_run",
      details: {
        title,
        articleId,
        articleMode: article.articleMode,
        wouldPublishTo: "wordpress",
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

  const result = await createDraftPost({
    title,
    content: article.content,
    excerpt,
    slug: article.slug ?? undefined,
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

  return {
    success: true,
    dryRun: false,
    message: "WordPress 초안이 생성되었습니다.",
    postUrl: result.postUrl,
    externalPostId: String(result.externalPostId),
  };
}
