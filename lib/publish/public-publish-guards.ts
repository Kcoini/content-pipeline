// Phase 2-16: Human Approval Before Public Publish의 승인 결과를 바탕으로,
// Phase 2-17(실제 WordPress public publish)에서 사용할 guard를 준비한다.
// 이 파일의 함수는 조건을 만족하지 않으면 절대 WordPress API를 호출하지
// 않도록 상위 서비스(wordpress-public-publish-service.ts)에서 반드시 먼저
// 호출해야 한다.

import { getArticleById } from "@/lib/repositories/article-repository";
import { getSuccessfulWordPressDraft } from "@/lib/repositories/publish-repository";

export class PublicPublishNotAllowedError extends Error {
  constructor(
    public readonly articleId: string,
    public readonly reasons: string[]
  ) {
    super(`기사(${articleId})는 아직 public publish를 진행할 수 없습니다: ${reasons.join(" / ")}`);
    this.name = "PublicPublishNotAllowedError";
  }
}

export interface PublicPublishGuardResult {
  canPublish: boolean;
  /** 차단 사유 요약 (canPublish=false일 때만 존재). 인증 정보는 포함하지 않는다. */
  reason: string | null;
  reasons: string[];
  /** 이미 공개(publish)된 기사여서 차단된 경우 true (재공개 방지용, 일반 blocked와 구분). */
  alreadyPublished: boolean;
  wordpressPostId: string | null;
  wordpressPostUrl: string | null;
  /** UI/로그에 안전하게 노출 가능한 요약 (본문/인증정보 없음). */
  summary: {
    publishReady: boolean;
    qualityGateStatus: string;
    approvalStatus: string;
    articleStatus: string;
  };
}

/**
 * article이 실제 public publish를 진행할 수 있는 상태인지 확인하고, WordPress
 * draft post id/url을 포함한 안전한 요약을 반환한다 (예외를 던지지 않는다).
 * 이 함수가 canPublish=false를 반환하면 호출자는 절대 WordPress API를
 * 호출해서는 안 된다.
 */
export async function checkPublicPublishGuard(articleId: string): Promise<PublicPublishGuardResult> {
  const article = await getArticleById(articleId);
  if (!article) {
    return {
      canPublish: false,
      reason: `기사를 찾을 수 없습니다: ${articleId}`,
      reasons: [`기사를 찾을 수 없습니다: ${articleId}`],
      alreadyPublished: false,
      wordpressPostId: null,
      wordpressPostUrl: null,
      summary: {
        publishReady: false,
        qualityGateStatus: "not_checked",
        approvalStatus: "not_requested",
        articleStatus: "draft",
      },
    };
  }

  const reasons: string[] = [];

  if (!(article.status === "reviewed" || article.status === "published")) {
    reasons.push(`article.status=${article.status} (reviewed 또는 published가 아닙니다).`);
  }
  if (!article.publishReady) {
    reasons.push("publish_ready가 true가 아닙니다.");
  }
  if (article.publishQualityGateStatus !== "ready_to_publish") {
    reasons.push(`publish_quality_gate_status=${article.publishQualityGateStatus} (ready_to_publish가 아닙니다).`);
  }
  if (article.publicPublishApprovalStatus !== "approved") {
    reasons.push(`public_publish_approval_status=${article.publicPublishApprovalStatus} (approved가 아닙니다).`);
  }
  if (!article.publicPublishApproved) {
    reasons.push("public_publish_approved가 true가 아닙니다.");
  }
  if (article.publishBlockedReason) {
    reasons.push(`publish_blocked_reason이 존재합니다: ${article.publishBlockedReason}`);
  }

  const existingDraft = await getSuccessfulWordPressDraft(articleId);
  if (!existingDraft) {
    reasons.push("WordPress draft post id가 존재하지 않습니다 (publish_logs.target='wordpress', status='success').");
  }

  // Featured Image Workflow: Quality Gate에서는 이미지 source가 준비만
  // 되어도 warning으로 통과할 수 있지만, 실제 공개(publish)는 media_id가
  // 실제로 존재하거나 featured_media가 attach되어 있어야만 허용한다.
  const hasFeaturedMedia =
    Boolean(article.featuredImageWordpressMediaId) || article.wordpressFeaturedMediaAttachStatus === "attached";
  if (!hasFeaturedMedia) {
    reasons.push(
      "featured_image_wordpress_media_id 또는 wordpress_featured_media_attach_status='attached'가 필요합니다 (대표 이미지가 아직 완료되지 않았습니다)."
    );
  }

  const alreadyPublished = article.publicPublished === true;
  if (alreadyPublished) {
    reasons.push("이미 공개(publish)된 기사입니다 (중복 공개 방지).");
  }

  const canPublish = reasons.length === 0;

  return {
    canPublish,
    reason: canPublish ? null : reasons.join(" / "),
    reasons,
    alreadyPublished,
    wordpressPostId: existingDraft?.externalPostId ?? null,
    wordpressPostUrl: existingDraft?.postUrl ?? null,
    summary: {
      publishReady: article.publishReady,
      qualityGateStatus: article.publishQualityGateStatus,
      approvalStatus: article.publicPublishApprovalStatus,
      articleStatus: article.status,
    },
  };
}

/**
 * article이 실제 public publish를 진행할 수 있는 상태인지 확인한다.
 * publish_ready, publish_quality_gate_status, public_publish_approval_status/
 * public_publish_approved, publish_blocked_reason, article.status, WordPress
 * draft post 존재 여부, 이미 공개되었는지 여부를 모두 확인한다. 조건을
 * 만족하지 않으면 예외를 던지며, 이 함수는 검증만 수행하고 실제 publish는
 * 수행하지 않는다.
 */
export async function assertCanPublicPublish(articleId: string): Promise<void> {
  const result = await checkPublicPublishGuard(articleId);
  if (!result.canPublish) {
    throw new PublicPublishNotAllowedError(articleId, result.reasons);
  }
}
