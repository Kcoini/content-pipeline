// Phase 2-17: WordPress Public Publish Test.
// Phase 2-15 Publish Quality Gate와 Phase 2-16 Human Approval을 모두 통과한
// article 1개에 한해서만 WordPress draft post를 실제 public publish 상태로
// 변경한다. 자동 공개(publish)가 아니며, UI에서 사람이 버튼을 직접 눌렀을
// 때만 이 함수가 호출된다. guard를 통과하지 못하면 WordPress API를 절대
// 호출하지 않는다.

import { getArticleById, savePublicPublishResult } from "@/lib/repositories/article-repository";
import { savePublishLog } from "@/lib/repositories/publish-repository";
import { logEvent } from "@/lib/harness/logger";
import type { LogEventType, LogStatus } from "@/lib/harness/logger";
import { checkPublicPublishGuard } from "@/lib/publish/public-publish-guards";
import { publishWordPressPost } from "@/lib/publish/wordpress-client";
import type { Article } from "@/lib/types/domain";

export const WORDPRESS_PUBLIC_PUBLISH_TARGET = "wordpress_public_publish";

export type PublicPublishOutcomeStatus = "published" | "blocked" | "failed" | "skipped_already_published";

export interface PublishApprovedArticleResult {
  success: boolean;
  message: string;
  status: PublicPublishOutcomeStatus;
  postUrl?: string;
}

async function logPublishEvent(
  type: LogEventType,
  status: LogStatus,
  message: string,
  articleId: string,
  article: Article | null,
  details?: Record<string, unknown>
): Promise<void> {
  await logEvent({
    type,
    status,
    message,
    articleId,
    themeId: article?.themeId,
    targetType: "article",
    targetId: articleId,
    ...(details ? { details } : {}),
  });
}

/**
 * 승인된 article 1개를 WordPress에 실제 공개(publish)한다. 여러 article을
 * 한 번에 처리하는 기능은 의도적으로 제공하지 않는다 (호출자는 반드시
 * article 1개의 id만 전달해야 한다). guard(checkPublicPublishGuard)를
 * 통과하지 못하면 WordPress API를 절대 호출하지 않는다.
 */
export async function publishApprovedArticleToWordPress(articleId: string): Promise<PublishApprovedArticleResult> {
  const article = await getArticleById(articleId);

  await logPublishEvent(
    "wordpress_public_publish_started",
    "info",
    `기사(${articleId})의 WordPress public publish를 시작합니다.`,
    articleId,
    article ?? null
  );

  if (!article) {
    const message = `기사를 찾을 수 없습니다: ${articleId}`;
    await logPublishEvent("wordpress_public_publish_failed", "failed", message, articleId, null);
    await savePublishLog({
      articleId,
      target: WORDPRESS_PUBLIC_PUBLISH_TARGET,
      status: "failed",
      errorMessage: message,
      details: { actual: false, publicPublishAction: false },
    });
    return { success: false, message, status: "failed" };
  }

  try {
    const guard = await checkPublicPublishGuard(articleId);

    if (guard.alreadyPublished) {
      await savePublicPublishResult(articleId, {
        status: "skipped_already_published",
        published: true,
        errorMessage: null,
      });

      await logPublishEvent(
        "wordpress_public_publish_skipped_already_published",
        "info",
        `기사(${articleId})는 이미 공개(publish)된 상태입니다.`,
        articleId,
        article
      );

      await savePublishLog({
        articleId,
        target: WORDPRESS_PUBLIC_PUBLISH_TARGET,
        status: "skipped",
        externalPostId: guard.wordpressPostId,
        postUrl: guard.wordpressPostUrl,
        errorMessage: null,
        details: { actual: false, publicPublishAction: false, reason: "already_published" },
      });

      return {
        success: true,
        message: `기사(${articleId})는 이미 공개(publish)된 상태입니다.`,
        status: "skipped_already_published",
        postUrl: guard.wordpressPostUrl ?? undefined,
      };
    }

    if (!guard.canPublish) {
      const reasonSummary = guard.reason ?? "알 수 없는 사유로 차단되었습니다.";

      await savePublicPublishResult(articleId, {
        status: "blocked",
        published: false,
        errorMessage: reasonSummary,
      });

      await logPublishEvent(
        "wordpress_public_publish_guard_failed",
        "failed",
        `기사(${articleId})의 public publish guard가 실패했습니다: ${reasonSummary}`,
        articleId,
        article,
        { reasons: guard.reasons }
      );
      await logPublishEvent(
        "wordpress_public_publish_blocked",
        "failed",
        `기사(${articleId})의 WordPress public publish가 차단되었습니다: ${reasonSummary}`,
        articleId,
        article,
        { reasons: guard.reasons }
      );

      await savePublishLog({
        articleId,
        target: WORDPRESS_PUBLIC_PUBLISH_TARGET,
        status: "failed",
        externalPostId: guard.wordpressPostId,
        postUrl: guard.wordpressPostUrl,
        errorMessage: reasonSummary,
        details: {
          actual: false,
          publicPublishAction: false,
          guardPassed: false,
          reason: reasonSummary,
          publishReady: guard.summary.publishReady,
          qualityGateStatus: guard.summary.qualityGateStatus,
          approvalStatus: guard.summary.approvalStatus,
        },
      });

      return { success: false, message: reasonSummary, status: "blocked" };
    }

    await logPublishEvent(
      "wordpress_public_publish_guard_passed",
      "info",
      `기사(${articleId})의 public publish guard를 통과했습니다.`,
      articleId,
      article,
      { wordpressPostId: guard.wordpressPostId }
    );

    const postId = Number(guard.wordpressPostId);

    const publishResult = await publishWordPressPost(postId);

    if (!publishResult.success) {
      await savePublicPublishResult(articleId, {
        status: "failed",
        published: false,
        errorMessage: publishResult.errorMessage,
      });

      await logPublishEvent(
        "wordpress_public_publish_failed",
        "failed",
        `기사(${articleId})의 WordPress public publish 실패: ${publishResult.errorMessage}`,
        articleId,
        article,
        { statusCode: publishResult.statusCode }
      );

      await savePublishLog({
        articleId,
        target: WORDPRESS_PUBLIC_PUBLISH_TARGET,
        status: "failed",
        externalPostId: guard.wordpressPostId,
        postUrl: guard.wordpressPostUrl,
        errorMessage: publishResult.errorMessage,
        details: {
          actual: true,
          publicPublishAction: true,
          statusCode: publishResult.statusCode ?? null,
          reasonCandidate: publishResult.reasonCandidate,
        },
      });

      return { success: false, message: publishResult.errorMessage, status: "failed" };
    }

    const publishedAt = new Date().toISOString();

    await savePublicPublishResult(articleId, {
      status: "published",
      published: true,
      publishedAt,
      postId: publishResult.postId,
      postUrl: publishResult.link,
      errorMessage: null,
    });

    await logPublishEvent(
      "wordpress_public_publish_completed",
      "success",
      `기사(${articleId})의 WordPress public publish가 완료되었습니다.`,
      articleId,
      article,
      { postId: publishResult.postId }
    );

    await savePublishLog({
      articleId,
      target: WORDPRESS_PUBLIC_PUBLISH_TARGET,
      status: "success",
      externalPostId: String(publishResult.postId),
      postUrl: publishResult.link,
      errorMessage: null,
      details: {
        actual: true,
        publicPublishAction: true,
        wordpressStatus: publishResult.status,
        guardPassed: true,
        approvalStatus: guard.summary.approvalStatus,
        publishReady: guard.summary.publishReady,
        qualityGateStatus: guard.summary.qualityGateStatus,
      },
    });

    return {
      success: true,
      message: `기사(${articleId})가 WordPress에 실제 공개(publish)되었습니다.`,
      status: "published",
      postUrl: publishResult.link,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";

    try {
      await savePublicPublishResult(articleId, { status: "failed", published: false, errorMessage: message });
    } catch {
      // 결과 저장 실패는 무시하고 원래 오류를 그대로 알린다.
    }

    await logPublishEvent(
      "wordpress_public_publish_failed",
      "failed",
      `WordPress public publish 실패: ${message}`,
      articleId,
      article
    );

    await savePublishLog({
      articleId,
      target: WORDPRESS_PUBLIC_PUBLISH_TARGET,
      status: "failed",
      errorMessage: message,
      details: { actual: false, publicPublishAction: false },
    });

    return { success: false, message, status: "failed" };
  }
}
