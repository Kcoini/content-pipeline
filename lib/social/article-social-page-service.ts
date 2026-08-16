// Phase 3-16 (Article/Blog/Social/Rewrite/Performance Page Separation):
// /articles/[id]/social 페이지 전용 데이터 조회. naver_cafe/x/threads/
// instagram(community/social content group)만 다루며, wordpress_blog/
// naver_blog는 포함하지 않는다. 이 파일의 어떤 함수도 데이터를
// 변경하지 않는다.
//
// Phase 3-18: pagination(page/perPage)과 deep link target(targetSocialPostId)의
// targetPage 계산을 추가했다. 필터링 로직은 전혀 바꾸지 않았다.

import { getArticleById } from "@/lib/repositories/article-repository";
import { listSocialPostsByArticle } from "@/lib/repositories/social-posts-repository";
import { getPlatformGroup } from "./content-type-classifier";
import { paginateItems, findItemPage, DEFAULT_PAGE, DEFAULT_PER_PAGE, type PaginationInfo } from "@/lib/navigation/pagination";
import type { SocialPost } from "./social-platform-types";
import type { Article } from "@/lib/types/domain";

export interface ArticleSocialPageData {
  article: Article | null;
  posts: SocialPost[];
  pagination: PaginationInfo;
  targetPage: number | null;
}

export interface ArticleSocialPageOptions {
  /** rewrite version(SNS/커뮤니티 계열)을 함께 보여줄지. 기본은 false. */
  includeRewriteVersions?: boolean;
  page?: number;
  perPage?: number;
  targetSocialPostId?: string;
}

/** naver_cafe/x/threads/instagram social_post만 조회한다 (기본: rewrite version 제외). */
export async function buildArticleSocialPageData(articleId: string, options: ArticleSocialPageOptions = {}): Promise<ArticleSocialPageData> {
  const includeRewriteVersions = options.includeRewriteVersions ?? false;
  const page = options.page ?? DEFAULT_PAGE;
  const perPage = options.perPage ?? DEFAULT_PER_PAGE;

  const [article, allPosts] = await Promise.all([getArticleById(articleId), listSocialPostsByArticle(articleId)]);

  const filteredPosts = allPosts.filter((post) => {
    const group = getPlatformGroup(post.platform);
    if (group !== "community" && group !== "social") return false;
    if (post.isRewriteVersion && !includeRewriteVersions) return false;
    return true;
  });

  const { items: posts, pagination } = paginateItems(filteredPosts, page, perPage);
  const targetPage = options.targetSocialPostId
    ? findItemPage(filteredPosts, (post) => post.id === options.targetSocialPostId, perPage)
    : null;

  return { article: article ?? null, posts, pagination, targetPage };
}
