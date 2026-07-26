// Phase 2-16: Human Approval Before Public Publish의 승인 결과를 바탕으로,
// Phase 2-17(실제 WordPress public publish)에서 사용할 guard를 미리 준비한다.
// 이 파일의 함수는 실제 publish를 실행하지 않으며, 조건을 만족하지 않으면
// 예외를 던져 다음 단계에서 실행을 차단하는 용도로만 사용한다.

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

/**
 * article이 실제 public publish를 진행할 수 있는 상태인지 확인한다.
 * publish_ready, publish_quality_gate_status, public_publish_approval_status/
 * public_publish_approved, WordPress draft post 존재 여부를 모두 만족해야
 * 통과한다. 이 함수는 검증만 수행하며 실제 publish는 수행하지 않는다.
 */
export async function assertCanPublicPublish(articleId: string): Promise<void> {
  const article = await getArticleById(articleId);
  if (!article) {
    throw new PublicPublishNotAllowedError(articleId, [`기사를 찾을 수 없습니다: ${articleId}`]);
  }

  const reasons: string[] = [];

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

  const existingDraft = await getSuccessfulWordPressDraft(articleId);
  if (!existingDraft) {
    reasons.push("WordPress draft post id가 존재하지 않습니다.");
  }

  if (reasons.length > 0) {
    throw new PublicPublishNotAllowedError(articleId, reasons);
  }
}
