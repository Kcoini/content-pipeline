// Phase 3-16 (Article/Blog/Social/Rewrite/Performance Page Separation):
// /articles/[id]/blog 페이지 전용 데이터 조회. wordpress_blog/naver_blog
// (blog content group)만 다루며, naver_cafe/x/threads/instagram은
// 포함하지 않는다. 이 파일의 어떤 함수도 데이터를 변경하지 않는다.
//
// Phase 3-18: pagination(page/perPage)과 deep link target(targetSocialPostId)의
// targetPage 계산을 추가했다. 필터링 로직(어떤 social_post가 blog 목록에
// 포함되는지)은 전혀 바꾸지 않았다 — 필터링 결과를 자르는 단계만 추가됐다.

import { getArticleById } from "@/lib/repositories/article-repository";
import { listSocialPostsByArticle } from "@/lib/repositories/social-posts-repository";
import { getPlatformGroup } from "./content-type-classifier";
import { paginateItems, findItemPage, DEFAULT_PAGE, DEFAULT_PER_PAGE, type PaginationInfo } from "@/lib/navigation/pagination";
import type { SocialPost } from "./social-platform-types";
import type { Article } from "@/lib/types/domain";

export interface ArticleBlogPageData {
  article: Article | null;
  /** 현재 page에 해당하는 blog post 목록. */
  posts: SocialPost[];
  pagination: PaginationInfo;
  /** targetSocialPostId를 지정했고 목록에 존재하면 그 항목이 속한 page 번호, 없으면 null. */
  targetPage: number | null;
}

export interface ArticleBlogPageOptions {
  /** rewrite version(blog 계열)을 함께 보여줄지. 기본은 false(원본 blog 글만). */
  includeRewriteVersions?: boolean;
  page?: number;
  perPage?: number;
  /** deep link로 강조하려는 social_post id — 몇 번째 page에 있는지 계산하는 데만 쓰인다. */
  targetSocialPostId?: string;
}

/** wordpress_blog/naver_blog social_post만 조회한다 (기본: rewrite version 제외). */
export async function buildArticleBlogPageData(articleId: string, options: ArticleBlogPageOptions = {}): Promise<ArticleBlogPageData> {
  const includeRewriteVersions = options.includeRewriteVersions ?? false;
  const page = options.page ?? DEFAULT_PAGE;
  const perPage = options.perPage ?? DEFAULT_PER_PAGE;

  const [article, allPosts] = await Promise.all([getArticleById(articleId), listSocialPostsByArticle(articleId)]);

  const filteredPosts = allPosts.filter((post) => {
    if (getPlatformGroup(post.platform) !== "blog") return false;
    if (post.isRewriteVersion && !includeRewriteVersions) return false;
    return true;
  });

  const { items: posts, pagination } = paginateItems(filteredPosts, page, perPage);
  const targetPage = options.targetSocialPostId
    ? findItemPage(filteredPosts, (post) => post.id === options.targetSocialPostId, perPage)
    : null;

  return { article: article ?? null, posts, pagination, targetPage };
}
