// wordpress_blog 글 카드의 "SEO Metadata 재생성" 버튼이 사용하는 서비스.
// 본문(post_title/post_body)은 다시 쓰지 않고, WordPress 게시용
// metadata(seoTitle/metaDescription/targetKeyword/secondaryKeywords/
// answerSummary/eeatNotes/geoSummary/structuredDataSuggestions/adSlots/
// monetizationScore/policyRiskScore)만 다시 만들어 platformMetadata에
// 채운다. 새로운 실제 AI API를 호출하지 않는다 — 이미 있는 wordpress_blog
// title/body/excerpt로부터 결정론적으로 도출한다
// (lib/social/wordpress-blog-metadata-generator.ts 재사용).

import { getSocialPostById, updateSocialPostContent } from "@/lib/repositories/social-posts-repository";
import { getArticleById } from "@/lib/repositories/article-repository";
import { generateWordPressBlogMetadata } from "./wordpress-blog-metadata-generator";
import { logEvent } from "@/lib/harness/logger";

export interface RegenerateWordPressBlogMetadataResult {
  success: boolean;
  message: string;
}

/**
 * wordpress_blog social_post의 WordPress 게시용 metadata를 다시 만들어
 * platformMetadata에 병합 저장한다. post_title/post_body는 건드리지 않는다.
 */
export async function regenerateWordPressBlogMetadata(
  articleId: string,
  socialPostId: string
): Promise<RegenerateWordPressBlogMetadataResult> {
  const post = await getSocialPostById(socialPostId);
  if (!post) {
    return { success: false, message: `블로그 글을 찾을 수 없습니다: ${socialPostId}` };
  }
  if (post.platform !== "wordpress_blog") {
    return { success: false, message: `이 기능은 wordpress_blog 글에서만 사용할 수 있습니다 (현재 platform: ${post.platform}).` };
  }

  const title = post.postTitle?.trim() ?? "";
  const body = post.postBody?.trim() ?? "";
  if (!title || !body) {
    return { success: false, message: "post_title/post_body가 비어 있어 metadata를 생성할 수 없습니다." };
  }

  const article = await getArticleById(articleId);

  const generated = generateWordPressBlogMetadata({
    title,
    body,
    excerpt: post.excerpt,
    citedSourceCount: article?.citedSourceIds.length,
    articleSeoTitle: article?.seoTitle,
    articleMetaDescription: article?.metaDescription,
    articleTargetKeyword: article?.targetKeyword,
    articleSecondaryKeywords: article?.secondaryKeywords,
    articleSearchIntent: article?.searchIntent,
    articleReaderPersona: article?.readerPersona,
    articleAdSlots: article?.adSlots,
    articleMonetizationScore: article?.monetizationScore,
    articlePolicyRiskScore: article?.policyRiskScore,
  });

  const existingMetadata = post.platformMetadata ?? {};
  await updateSocialPostContent(socialPostId, {
    platformMetadata: {
      ...existingMetadata,
      ...generated,
    },
  });

  await logEvent({
    type: "wordpress_blog_metadata_regenerated",
    status: "success",
    message: `wordpress_blog 글(${socialPostId})의 WordPress 게시용 metadata를 재생성했습니다.`,
    // full content/prompt는 남기지 않고, 생성된 필드의 존재 여부만 기록한다.
    details: {
      socialPostId,
      hasSeoTitle: Boolean(generated.seoTitle),
      hasMetaDescription: Boolean(generated.metaDescription),
      hasTargetKeyword: Boolean(generated.targetKeyword),
      secondaryKeywordCount: generated.secondaryKeywords.length,
      monetizationScore: generated.monetizationScore,
      policyRiskScore: generated.policyRiskScore,
    },
    articleId,
    themeId: article?.themeId,
    targetType: "article",
    targetId: articleId,
  });

  return { success: true, message: "wordpress_blog 글의 WordPress 게시용 metadata를 재생성했습니다." };
}
