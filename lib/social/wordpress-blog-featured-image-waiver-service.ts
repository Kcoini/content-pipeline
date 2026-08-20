// wordpress_blog 글 카드의 "대표 이미지 없이 진행" 기능이 사용하는 서비스.
//
// DB 제약 확인 결과: articles.featured_image_upload_status에는
// `check (featured_image_upload_status in ('not_ready', 'prepared',
// 'dry_run', 'uploaded', 'failed', 'skipped'))` CHECK 제약이 있어
// 'waived'라는 새 값을 저장할 수 없다(db/migrations/016). 이를 위해
// CHECK 제약을 완화하는 migration을 추가하는 대신 — 이번 작업 지침
// ("DB schema 변경은 가능하면 금지")에 따라 — waive 상태를 article
// 컬럼에는 전혀 쓰지 않고, social_posts.platformMetadata.featuredImage
// (이미 존재하는 JSON 필드) 안에만 저장한다. article의 실제 media id/
// url 컬럼은 애초에 waive 시점에 비어 있으므로(연결한 적이 없으므로)
// 건드릴 필요가 없다.

import { getSocialPostById, updateSocialPostContent } from "@/lib/repositories/social-posts-repository";
import { getArticleById, saveFeaturedImageUploadResult } from "@/lib/repositories/article-repository";
import { logEvent } from "@/lib/harness/logger";

export type FeaturedImageWaiverReasonCode = "no_suitable_image" | "text_focused" | "manual_later" | "other";

export const FEATURED_IMAGE_WAIVER_REASONS: readonly { code: FeaturedImageWaiverReasonCode; label: string }[] = [
  { code: "no_suitable_image", label: "적절한 이미지가 없음" },
  { code: "text_focused", label: "텍스트 중심 글이라 이미지 없이 진행" },
  { code: "manual_later", label: "나중에 WordPress에서 수동 추가 예정" },
  { code: "other", label: "기타" },
];

function isFeaturedImageWaiverReasonCode(value: unknown): value is FeaturedImageWaiverReasonCode {
  return value === "no_suitable_image" || value === "text_focused" || value === "manual_later" || value === "other";
}

export interface WaiveWordPressFeaturedImageResult {
  success: boolean;
  message: string;
}

/**
 * wordpress_blog 글에 대해 "대표 이미지 없이 진행"을 사용자가 명시적으로
 * 선택했음을 기록한다. media id/url은 비워두고(이미 없었다면 그대로),
 * waived 플래그와 사유만 platformMetadata에 저장한다 — 자동 판단이
 * 아니라 사람이 누른 결과라는 것을 항상 reasonCode로 남긴다.
 */
export async function waiveWordPressFeaturedImageForBlogPost(
  articleId: string,
  socialPostId: string,
  reasonCode: unknown,
  memo?: string
): Promise<WaiveWordPressFeaturedImageResult> {
  const post = await getSocialPostById(socialPostId);
  if (!post) {
    return { success: false, message: `블로그 글을 찾을 수 없습니다: ${socialPostId}` };
  }
  if (post.platform !== "wordpress_blog") {
    return { success: false, message: `이 기능은 wordpress_blog 글에서만 사용할 수 있습니다 (현재 platform: ${post.platform}).` };
  }
  if (!isFeaturedImageWaiverReasonCode(reasonCode)) {
    return { success: false, message: "대표 이미지 생략 사유를 선택하세요." };
  }

  const existingMetadata = post.platformMetadata ?? {};
  const existingFeaturedImage =
    typeof existingMetadata.featuredImage === "object" && existingMetadata.featuredImage !== null
      ? (existingMetadata.featuredImage as Record<string, unknown>)
      : {};

  const trimmedMemo = reasonCode === "other" ? memo?.trim() || null : null;

  // article 쪽 media id/url도 함께 비워서 article/social_post 상태가
  // 어긋나지 않게 한다. status='skipped'는 CHECK 제약이 이미 허용하는
  // 기존 값이다(articles_featured_image_upload_status_check) — 새 값을
  // 추가하지 않는다.
  await saveFeaturedImageUploadResult(articleId, {
    status: "skipped",
    wordpressMediaId: null,
    wordpressUrl: null,
    errorMessage: null,
  });

  await updateSocialPostContent(socialPostId, {
    platformMetadata: {
      ...existingMetadata,
      featuredImage: {
        ...existingFeaturedImage,
        wordpressMediaId: null,
        wordpressUrl: null,
        waived: true,
        waivedReasonCode: reasonCode,
        waivedMemo: trimmedMemo,
        waivedAt: new Date().toISOString(),
      },
    },
  });

  const article = await getArticleById(articleId);
  await logEvent({
    type: "wordpress_featured_image_waived",
    status: "info",
    message: `wordpress_blog 글(${socialPostId})이 대표 이미지 없이 진행하도록 선택되었습니다.`,
    details: { socialPostId, platform: "wordpress_blog", reasonCode, hasMemo: Boolean(trimmedMemo), status: "waived" },
    articleId,
    themeId: article?.themeId,
    targetType: "article",
    targetId: articleId,
  });

  return { success: true, message: "대표 이미지 없이 진행하도록 설정했습니다." };
}
