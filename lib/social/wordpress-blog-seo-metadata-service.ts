// wordpress_blog 글 카드에서 SEO metadata 업데이트를 완결할 수 있게 하는
// 서비스. 기존 generateWordPressMetadata()(article 기준 category/tag/slug
// 추천 로직, Phase 2-3)는 slug/category/tag/internalLinkSuggestions에만
// 그대로 재사용한다(수정하지 않음). seoTitle/metaDescription/targetKeyword/
// secondaryKeywords는 **오직 wordpress_blog social_post 자체의 값**만
// 사용하며, article의 추천값으로 대체(fallback)하지 않는다 — wordpress_blog
// 글 생성 시 이미 이 값들을 스스로 만들어 platformMetadata에 저장해 두기
// 때문이다(lib/social/wordpress-blog-metadata-generator.ts). 만약 이 값이
// 없다면(예: 이 기능이 추가되기 전에 생성된 옛 글) "SEO Metadata 재생성"
// (regenerateWordPressBlogMetadata)으로 먼저 채우도록 차단하고 안내한다.
// 새로운 실제 API 호출은 추가하지 않는다 — 저장 대상 컬럼은 기존과 동일하게
// articles 테이블이다(social_posts에 별도 SEO 컬럼이 없기 때문 — DB 스키마
// 변경 없이 처리하기 위한 절충이다).

import { getArticleById, saveWordPressMetadata } from "@/lib/repositories/article-repository";
import { getSocialPostById } from "@/lib/repositories/social-posts-repository";
import { generateWordPressMetadata } from "@/lib/publish/wordpress-metadata-service";
import { checkWordPressBlogPublishReadiness } from "./wordpress-blog-publish-readiness";
import { logEvent } from "@/lib/harness/logger";

export interface UpdateWordPressSeoMetadataFromBlogPostResult {
  success: boolean;
  message: string;
}

function readOptionalString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readOptionalStringArray(record: Record<string, unknown>, key: string): string[] | null {
  const value = record[key];
  if (!Array.isArray(value)) return null;
  const strings = value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  return strings.length > 0 ? strings : null;
}

/**
 * wordpress_blog social_post를 기준으로 article의 WordPress SEO metadata를
 * 갱신한다. post가 quality_status=ready/approval_status=approved 등 게시
 * 준비 조건을 만족하지 못하면 아무것도 저장하지 않고 차단 이유를 반환한다.
 */
export async function updateWordPressSeoMetadataFromBlogPost(
  articleId: string,
  socialPostId: string
): Promise<UpdateWordPressSeoMetadataFromBlogPostResult> {
  const post = await getSocialPostById(socialPostId);
  if (!post) {
    return { success: false, message: `블로그 글을 찾을 수 없습니다: ${socialPostId}` };
  }
  if (post.platform !== "wordpress_blog") {
    return { success: false, message: `이 기능은 wordpress_blog 글에서만 사용할 수 있습니다 (현재 platform: ${post.platform}).` };
  }

  const readiness = checkWordPressBlogPublishReadiness(post);
  if (!readiness.ready) {
    return { success: false, message: `SEO metadata 업데이트가 차단되었습니다: ${readiness.blockers.join(" / ")}` };
  }

  const article = await getArticleById(articleId);
  if (!article) {
    return { success: false, message: `기사를 찾을 수 없습니다: ${articleId}` };
  }

  // wordpress_blog 자신의 metadata만 사용한다 — article의 추천값으로
  // 대체하지 않는다. seoTitle만 예외적으로 post_title을 최후 fallback으로
  // 허용한다(post_title도 article이 아니라 wordpress_blog 자신의 필드다).
  const platformMetadata = post.platformMetadata ?? {};
  const blogSeoTitle = readOptionalString(platformMetadata, "seoTitle") ?? post.postTitle?.trim() ?? null;
  const blogMetaDescription = readOptionalString(platformMetadata, "metaDescription");
  const blogTargetKeyword = readOptionalString(platformMetadata, "targetKeyword");
  const blogSecondaryKeywords = readOptionalStringArray(platformMetadata, "secondaryKeywords") ?? [];

  const missingFields: string[] = [];
  if (!blogSeoTitle) missingFields.push("seoTitle");
  if (!blogMetaDescription) missingFields.push("metaDescription");
  if (!blogTargetKeyword) missingFields.push("targetKeyword");

  if (missingFields.length > 0) {
    return {
      success: false,
      message:
        `wordpress_blog 글에 ${missingFields.join("/")}이(가) 없어 SEO metadata를 업데이트할 수 없습니다. ` +
        `article의 추천값으로 대신하지 않습니다 — "SEO Metadata 재생성" 기능으로 wordpress_blog 글 자체의 ` +
        `metadata를 먼저 만드세요.`,
    };
  }

  // category/tag/slug/internalLinkSuggestions는 article 기준 추천 로직을 그대로
  // 재사용한다(수정하지 않음) — 이 값들은 SEO 문구가 아니라 taxonomy이므로
  // article 기준으로 계속 추천해도 "article metadata fallback 금지" 원칙과
  // 충돌하지 않는다.
  const base = await generateWordPressMetadata(articleId);
  if (!base.success || !base.metadata) {
    return { success: false, message: `기본 WordPress metadata 생성에 실패했습니다: ${base.message}` };
  }

  await saveWordPressMetadata({
    articleId,
    seoTitle: blogSeoTitle!,
    metaDescription: blogMetaDescription!,
    slug: base.metadata.slug,
    targetKeyword: blogTargetKeyword!,
    targetKeywordSource: "wordpress_blog_post",
    secondaryKeywords: blogSecondaryKeywords,
    internalLinkSuggestions: base.metadata.internalLinkSuggestions,
    categoryNames: base.metadata.categoryNames,
    tagNames: base.metadata.tagNames,
    categoryIds: base.metadata.categoryIds,
    tagIds: base.metadata.tagIds,
    status: "generated",
  });

  await logEvent({
    type: "wordpress_metadata_generation_completed",
    status: "success",
    message: `wordpress_blog 글(${socialPostId}) 기준으로 WordPress SEO metadata를 갱신했습니다.`,
    details: { socialPostId, usedBlogSeoFields: true },
    articleId,
    themeId: article.themeId,
    targetType: "article",
    targetId: articleId,
  });

  return {
    success: true,
    message: "wordpress_blog 글의 SEO 필드를 기준으로 SEO metadata를 업데이트했습니다.",
  };
}
