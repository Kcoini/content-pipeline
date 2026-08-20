// wordpress_blog 글 카드에서 "대표 이미지 준비"를 완결할 수 있게 하는 서비스.
// 실제 WordPress media_id/url은 articles 테이블에만 컬럼이 있고
// social_posts에는 없다(DB 스키마를 바꾸지 않기 위한 절충) — 그래서 이
// 서비스는 두 곳에 나눠 기록한다:
//   1) articles.featured_image_wordpress_media_id/url — 기존
//      saveExistingWordPressMedia()(Phase 2-19)를 그대로 재사용해 저장한다.
//      실제 "대표 이미지 연결"(attachFeaturedMediaToDraft)이 읽는 값도
//      바로 이 컬럼이므로, 여기 저장해야 연결이 실제로 동작한다.
//   2) social_posts.platformMetadata.featuredImage — wordpress_blog
//      카드에서 "이 글 기준으로 무엇을 입력했는지" 보여주기 위한
//      기존 필드(platformMetadata) 안의 부가 정보. 새 컬럼을 추가하지
//      않는다.

import { getSocialPostById, updateSocialPostContent } from "@/lib/repositories/social-posts-repository";
import { saveExistingWordPressMedia } from "@/lib/images/featured-image-source-service";
import { logEvent } from "@/lib/harness/logger";
import { getArticleById } from "@/lib/repositories/article-repository";

export interface SaveWordPressFeaturedImageMediaResult {
  success: boolean;
  message: string;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * wordpress_blog 글 기준으로 "기존 WordPress Media ID"를 대표 이미지로
 * 지정한다. 실제 이미지 업로드나 AI 생성은 하지 않는다 — 이미 WordPress
 * Media Library에 있는 이미지의 id를 입력받아 저장만 한다.
 */
export async function saveWordPressFeaturedImageMediaForBlogPost(
  articleId: string,
  socialPostId: string,
  mediaId: number,
  mediaUrl?: string
): Promise<SaveWordPressFeaturedImageMediaResult> {
  const post = await getSocialPostById(socialPostId);
  if (!post) {
    return { success: false, message: `블로그 글을 찾을 수 없습니다: ${socialPostId}` };
  }
  if (post.platform !== "wordpress_blog") {
    return { success: false, message: `이 기능은 wordpress_blog 글에서만 사용할 수 있습니다 (현재 platform: ${post.platform}).` };
  }

  if (!Number.isFinite(mediaId) || !Number.isInteger(mediaId) || mediaId <= 0) {
    return { success: false, message: "WordPress media ID는 양의 정수여야 합니다." };
  }

  const trimmedUrl = mediaUrl?.trim();
  if (trimmedUrl && !isValidHttpUrl(trimmedUrl)) {
    return { success: false, message: "이미지 URL 형식이 올바르지 않습니다 (http:// 또는 https://로 시작해야 합니다)." };
  }

  // 1) 실제 연결(attachFeaturedMediaToDraft)이 읽는 article 컬럼에 저장한다
  //    (기존 Phase 2-19 로직을 그대로 재사용 — 새 실제 API 호출 없음).
  const articleResult = await saveExistingWordPressMedia(articleId, { mediaId, mediaUrl: trimmedUrl });
  if (!articleResult.success) {
    return { success: false, message: articleResult.message };
  }

  // 2) wordpress_blog 글 카드에 표시할 정보를 platformMetadata에 함께 기록한다
  //    (새 컬럼 추가 없이 기존 platform_metadata JSON 필드를 사용한다).
  //    media ID를 새로 저장하는 것은 "대표 이미지 없이 진행" 선택을
  //    해제하는 행동이므로 waived를 false로 되돌린다.
  const existingMetadata = post.platformMetadata ?? {};
  await updateSocialPostContent(socialPostId, {
    platformMetadata: {
      ...existingMetadata,
      featuredImage: {
        wordpressMediaId: mediaId,
        wordpressUrl: trimmedUrl || null,
        savedAt: new Date().toISOString(),
        waived: false,
        waivedReasonCode: null,
        waivedMemo: null,
      },
    },
  });

  const article = await getArticleById(articleId);
  await logEvent({
    type: "blog_post_featured_image_media_saved",
    status: "success",
    message: `wordpress_blog 글(${socialPostId}) 기준으로 대표 이미지 media ID를 저장했습니다.`,
    details: { socialPostId, mediaId, hasUrl: Boolean(trimmedUrl) },
    articleId,
    themeId: article?.themeId,
    targetType: "article",
    targetId: articleId,
  });

  return { success: true, message: `WordPress media ID(${mediaId})를 대표 이미지로 저장했습니다.` };
}
