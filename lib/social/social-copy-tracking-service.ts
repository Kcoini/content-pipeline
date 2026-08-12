// Phase 3-5: Manual Export & Copy Workflow — 복사 여부 추적.
// 사용자가 export된 콘텐츠를 실제로 복사했는지만 집계한다. 복사한
// 텍스트 전문은 어디에도 저장하지 않는다.

import { getSocialPostById, incrementExportCopyCount } from "@/lib/repositories/social-posts-repository";
import { logEvent } from "@/lib/harness/logger";
import type { SocialPost } from "./social-platform-types";

export interface RecordSocialPostCopiedResult {
  success: boolean;
  message: string;
  socialPost?: SocialPost;
}

/**
 * social post의 export 결과가 복사되었음을 기록한다 (export_copy_count
 * 증가, last_copied_at 갱신). copyTarget은 "title"/"body"/"caption"/
 * "hashtags"/"thread"/"card"/"all" 등 UI에서 어떤 버튼을 눌렀는지만 담고,
 * 복사한 텍스트 전문은 담지 않는다.
 */
export async function recordSocialPostCopied(
  socialPostId: string,
  copiedBy?: string,
  copyTarget?: string
): Promise<RecordSocialPostCopiedResult> {
  const existing = await getSocialPostById(socialPostId);
  if (!existing) {
    return { success: false, message: `social post를 찾을 수 없습니다: ${socialPostId}` };
  }

  try {
    const updated = await incrementExportCopyCount(socialPostId);

    await logEvent({
      type: "social_manual_export_copied",
      status: "info",
      message: `social post(${socialPostId})의 export 결과가 복사되었습니다 (target: ${copyTarget ?? "unknown"}).`,
      articleId: existing.articleId,
      targetType: "article",
      targetId: existing.articleId,
      details: {
        socialPostId,
        articleId: existing.articleId,
        platform: existing.platform,
        toneStyle: existing.toneStyle,
        copyTarget: copyTarget ?? "unknown",
        exportFormat: existing.exportFormat,
        copyCount: updated.exportCopyCount,
        copiedBy: copiedBy ?? "unknown",
      },
    });

    return { success: true, message: "복사 기록을 저장했습니다.", socialPost: updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return { success: false, message };
  }
}
