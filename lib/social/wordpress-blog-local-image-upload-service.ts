// wordpress_blog 글 카드의 "내 컴퓨터에서 이미지 업로드" 섹션이 사용하는
// 서비스. 실제 새 API 호출 코드를 추가하지 않는다 — 이미 존재하는
// 2단계 파이프라인을 그대로 재사용해 이어붙일 뿐이다:
//   1) saveLocalImageUpload(articleId, file) — Phase 2-5/2-19: 로컬 파일을
//      Supabase Storage에 저장하고 article.featured_image_source_url에
//      기록한다 (아직 WordPress에는 업로드하지 않음).
//   2) uploadFeaturedImageToWordPress(articleId) — Phase 2-10: 그 URL을
//      읽어 실제 WordPress Media Library(POST /wp-json/wp/v2/media)에
//      업로드한다. WORDPRESS_MEDIA_UPLOAD_ENABLED=false면 실제 호출 없이
//      skip 처리된다(기존 동작 그대로).
//
// 업로드 성공 후에는 wordpress_blog 카드에 표시하기 위해
// social_posts.platformMetadata.featuredImage에도 media id/url을
// 반영한다 — 새 컬럼을 추가하지 않는다.

import { getSocialPostById, updateSocialPostContent } from "@/lib/repositories/social-posts-repository";
import { getArticleById } from "@/lib/repositories/article-repository";
import { saveLocalImageUpload } from "@/lib/images/featured-image-source-service";
import { uploadFeaturedImageToWordPress } from "@/lib/publish/wordpress-media-upload-service";
import { logEvent } from "@/lib/harness/logger";

export const ALLOWED_FEATURED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_FEATURED_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;

export interface UploadWordPressFeaturedImageFromBlogPostResult {
  success: boolean;
  message: string;
  wordpressMediaId?: number;
  wordpressUrl?: string;
}

/**
 * wordpress_blog 글 카드에서 선택한 로컬 이미지 파일을 검증한 뒤,
 * Supabase Storage 저장 → 실제 WordPress Media Library 업로드까지
 * 이어서 실행한다. alt text/caption은 이번 단계에서는 저장하지
 * 않는다(추후 지원 — 별도의 경량 저장 경로가 아직 없어 무리하게
 * 만들지 않았다).
 */
export async function uploadWordPressFeaturedImageFromBlogPost(
  articleId: string,
  socialPostId: string,
  file: File | null
): Promise<UploadWordPressFeaturedImageFromBlogPostResult> {
  const post = await getSocialPostById(socialPostId);
  if (!post) {
    return { success: false, message: `블로그 글을 찾을 수 없습니다: ${socialPostId}` };
  }
  if (post.platform !== "wordpress_blog") {
    return { success: false, message: `이 기능은 wordpress_blog 글에서만 사용할 수 있습니다 (현재 platform: ${post.platform}).` };
  }

  if (!file || file.size === 0) {
    return { success: false, message: "파일을 먼저 선택하세요." };
  }
  if (!(ALLOWED_FEATURED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
    return { success: false, message: "이미지 파일만 업로드할 수 있습니다 (JPEG/PNG/WEBP)." };
  }
  if (file.size > MAX_FEATURED_IMAGE_UPLOAD_BYTES) {
    return { success: false, message: "파일 크기는 5MB 이하만 업로드할 수 있습니다." };
  }

  // 1) 로컬 파일 → Supabase Storage (기존 경로 재사용).
  const sourceResult = await saveLocalImageUpload(articleId, file);
  if (!sourceResult.success) {
    return { success: false, message: sourceResult.message };
  }

  // 2) 실제 WordPress Media Library 업로드 (기존 경로 재사용, 새 API 호출 코드 없음).
  const uploadResult = await uploadFeaturedImageToWordPress(articleId);
  if (!uploadResult.success || !uploadResult.wordpressMediaId) {
    return { success: false, message: uploadResult.message };
  }

  // 3) wordpress_blog 카드 표시용 정보를 platformMetadata에 반영한다(새 컬럼 없음).
  //    업로드 성공은 "대표 이미지 없이 진행" 선택을 해제하는 행동이므로
  //    waived를 false로 되돌린다.
  const existingMetadata = post.platformMetadata ?? {};
  await updateSocialPostContent(socialPostId, {
    platformMetadata: {
      ...existingMetadata,
      featuredImage: {
        wordpressMediaId: uploadResult.wordpressMediaId,
        wordpressUrl: uploadResult.wordpressUrl ?? null,
        savedAt: new Date().toISOString(),
        source: "local_upload",
        waived: false,
        waivedReasonCode: null,
        waivedMemo: null,
      },
    },
  });

  const article = await getArticleById(articleId);
  await logEvent({
    type: "blog_post_featured_image_uploaded",
    status: "success",
    message: `wordpress_blog 글(${socialPostId}) 기준으로 로컬 이미지를 WordPress Media Library에 업로드했습니다.`,
    details: { socialPostId, mediaId: uploadResult.wordpressMediaId },
    articleId,
    themeId: article?.themeId,
    targetType: "article",
    targetId: articleId,
  });

  return {
    success: true,
    message: `WordPress 이미지 업로드가 완료되었습니다 (media id: ${uploadResult.wordpressMediaId}).`,
    wordpressMediaId: uploadResult.wordpressMediaId,
    wordpressUrl: uploadResult.wordpressUrl,
  };
}
