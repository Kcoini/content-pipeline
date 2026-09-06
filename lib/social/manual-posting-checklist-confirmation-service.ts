// wordpress_blog 카드 Step 7 체크리스트 중 "사람이 직접 확인해야 하는"
// 항목(needs_review)을 사용자가 확인한 뒤 "확인 완료"로 표시할 수 있게
// 하는 서비스. DB schema는 바꾸지 않고 기존
// social_posts.platform_metadata(JSON) 안에 confirmation 기록을 저장한다.
//
// 시스템이 DB 상태로 자동 판단하는 항목(quality_gate_ready,
// approval_approved 등)이나 URL 존재 여부로 판단하는 항목은 이 서비스로
// confirmed 처리할 수 없다 — computeManualPostingChecklistItemStatus()가
// 애초에 confirmations를 무시하고 실제 상태를 우선하도록 되어 있다
// (manual-posting-checklist-status.ts 참고).

import { getSocialPostById, updateSocialPostContent } from "@/lib/repositories/social-posts-repository";
import { logEvent } from "@/lib/harness/logger";
import { getArticleById } from "@/lib/repositories/article-repository";
import { CONFIRMABLE_MANUAL_CHECKLIST_ITEM_KEYS } from "./manual-posting-checklist-status";

// CONFIRMABLE_MANUAL_CHECKLIST_ITEM_KEYS는 manual-posting-checklist-status.ts에
// 정의되어 있다(status 계산 로직과 확인 가능 여부 판단이 같은 목록을 써야
// 어긋나지 않는다) — 여기서는 그대로 재노출만 한다.
export { CONFIRMABLE_MANUAL_CHECKLIST_ITEM_KEYS };

export interface MarkManualChecklistItemConfirmedResult {
  success: boolean;
  message: string;
}

/**
 * checklist item 하나를 "사람이 확인 완료"로 표시한다. 실제 게시나
 * DB 상태 변경(quality/approval/handoff 등)은 전혀 건드리지 않는다 —
 * 오직 platformMetadata.manualChecklistConfirmations에만 기록한다.
 */
export async function markManualChecklistItemConfirmed(
  articleId: string,
  socialPostId: string,
  checklistItemKey: string,
  confirmedBy: string
): Promise<MarkManualChecklistItemConfirmedResult> {
  const post = await getSocialPostById(socialPostId);
  if (!post) {
    return { success: false, message: `블로그 글을 찾을 수 없습니다: ${socialPostId}` };
  }
  if (post.platform !== "wordpress_blog") {
    return { success: false, message: `이 기능은 wordpress_blog 글에서만 사용할 수 있습니다 (현재 platform: ${post.platform}).` };
  }
  if (!CONFIRMABLE_MANUAL_CHECKLIST_ITEM_KEYS.has(checklistItemKey)) {
    return {
      success: false,
      message: `이 항목(${checklistItemKey})은 사람이 직접 확인 완료로 표시할 수 없습니다 — 시스템이 상태를 자동으로 계산합니다.`,
    };
  }

  const existingMetadata = post.platformMetadata ?? {};
  const existingConfirmations =
    typeof existingMetadata.manualChecklistConfirmations === "object" && existingMetadata.manualChecklistConfirmations !== null
      ? (existingMetadata.manualChecklistConfirmations as Record<string, unknown>)
      : {};

  await updateSocialPostContent(socialPostId, {
    platformMetadata: {
      ...existingMetadata,
      manualChecklistConfirmations: {
        ...existingConfirmations,
        [checklistItemKey]: {
          confirmed: true,
          confirmedAt: new Date().toISOString(),
          confirmedBy,
        },
      },
    },
  });

  const article = await getArticleById(articleId);
  await logEvent({
    type: "blog_post_manual_checklist_item_confirmed",
    status: "success",
    message: `wordpress_blog 글(${socialPostId})의 체크리스트 항목(${checklistItemKey})을 확인 완료로 표시했습니다.`,
    details: { socialPostId, checklistItemKey },
    articleId,
    themeId: article?.themeId,
    targetType: "article",
    targetId: articleId,
  });

  return { success: true, message: "체크리스트 항목을 확인 완료로 표시했습니다." };
}
