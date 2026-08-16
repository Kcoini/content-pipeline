// Phase 3-16 (Article/Blog/Social/Rewrite/Performance Page Separation):
// /articles/[id]/rewrite 페이지 전용 데이터 조회. rewrite suggestion과
// rewrite version(is_rewrite_version=true)만 다룬다 — 일반 social post와
// 섞어 보여주지 않는다. 이 파일의 어떤 함수도 데이터를 변경하지 않는다
// (재승인/재export 실행은 기존 rewrite-*-service가 그대로 담당한다).
//
// Phase 3-18: rewriteVersions에만 pagination을 적용했다(원본 글 선택
// select box/개선 제안 목록은 보통 훨씬 짧아 우선순위가 낮다는 스펙
// 안내에 따름). 필터링 로직은 바꾸지 않았다.

import { getArticleById } from "@/lib/repositories/article-repository";
import { listSocialPostsByArticle } from "@/lib/repositories/social-posts-repository";
import { listRewriteSuggestionsBySocialPost } from "@/lib/repositories/social-rewrite-suggestions-repository";
import { paginateItems, findItemPage, DEFAULT_PAGE, DEFAULT_PER_PAGE, type PaginationInfo } from "@/lib/navigation/pagination";
import type { SocialPost } from "./social-platform-types";
import type { SocialPostRewriteSuggestion } from "./social-rewrite-types";
import type { Article } from "@/lib/types/domain";

export interface ArticleRewritePageData {
  article: Article | null;
  /** 원본(rewrite version이 아닌) social_post — 개선 제안의 대상/맥락 확인용. */
  originalPosts: SocialPost[];
  /** is_rewrite_version=true인 social_post 중 현재 page. */
  rewriteVersions: SocialPost[];
  versionPagination: PaginationInfo;
  /** targetVersionId를 지정했고 목록에 존재하면 그 항목이 속한 page 번호. */
  versionTargetPage: number | null;
  suggestions: SocialPostRewriteSuggestion[];
}

export interface ArticleRewritePageOptions {
  page?: number;
  perPage?: number;
  targetVersionId?: string;
}

/** rewrite suggestion과 rewrite version만 조회한다 (onlyRewriteVersions=true와 동일한 기본값). */
export async function buildArticleRewritePageData(articleId: string, options: ArticleRewritePageOptions = {}): Promise<ArticleRewritePageData> {
  const page = options.page ?? DEFAULT_PAGE;
  const perPage = options.perPage ?? DEFAULT_PER_PAGE;

  const [article, allPosts] = await Promise.all([getArticleById(articleId), listSocialPostsByArticle(articleId)]);

  const originalPosts = allPosts.filter((post) => !post.isRewriteVersion);
  const allRewriteVersions = allPosts.filter((post) => post.isRewriteVersion);

  const suggestionLists = await Promise.all(allPosts.map((post) => listRewriteSuggestionsBySocialPost(post.id)));
  const suggestions = suggestionLists.flat();

  const { items: rewriteVersions, pagination: versionPagination } = paginateItems(allRewriteVersions, page, perPage);
  const versionTargetPage = options.targetVersionId
    ? findItemPage(allRewriteVersions, (post) => post.id === options.targetVersionId, perPage)
    : null;

  return { article: article ?? null, originalPosts, rewriteVersions, versionPagination, versionTargetPage, suggestions };
}
