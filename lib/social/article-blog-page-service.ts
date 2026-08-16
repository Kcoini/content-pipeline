// Phase 3-16 (Article/Blog/Social/Rewrite/Performance Page Separation):
// /articles/[id]/blog 페이지 전용 데이터 조회. wordpress_blog/naver_blog
// (blog content group)만 다루며, naver_cafe/x/threads/instagram은
// 포함하지 않는다. 이 파일의 어떤 함수도 데이터를 변경하지 않는다.

import { getArticleById } from "@/lib/repositories/article-repository";
import { listSocialPostsByArticle } from "@/lib/repositories/social-posts-repository";
import { getPlatformGroup } from "./content-type-classifier";
import type { SocialPost } from "./social-platform-types";
import type { Article } from "@/lib/types/domain";

export interface ArticleBlogPageData {
  article: Article | null;
  posts: SocialPost[];
}

export interface ArticleBlogPageOptions {
  /** rewrite version(blog 계열)을 함께 보여줄지. 기본은 false(원본 blog 글만). */
  includeRewriteVersions?: boolean;
}

/** wordpress_blog/naver_blog social_post만 조회한다 (기본: rewrite version 제외). */
export async function buildArticleBlogPageData(articleId: string, options: ArticleBlogPageOptions = {}): Promise<ArticleBlogPageData> {
  const includeRewriteVersions = options.includeRewriteVersions ?? false;

  const [article, allPosts] = await Promise.all([getArticleById(articleId), listSocialPostsByArticle(articleId)]);

  const posts = allPosts.filter((post) => {
    if (getPlatformGroup(post.platform) !== "blog") return false;
    if (post.isRewriteVersion && !includeRewriteVersions) return false;
    return true;
  });

  return { article: article ?? null, posts };
}
