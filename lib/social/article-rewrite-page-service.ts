// Phase 3-16 (Article/Blog/Social/Rewrite/Performance Page Separation):
// /articles/[id]/rewrite 페이지 전용 데이터 조회. rewrite suggestion과
// rewrite version(is_rewrite_version=true)만 다룬다 — 일반 social post와
// 섞어 보여주지 않는다. 이 파일의 어떤 함수도 데이터를 변경하지 않는다
// (재승인/재export 실행은 기존 rewrite-*-service가 그대로 담당한다).

import { getArticleById } from "@/lib/repositories/article-repository";
import { listSocialPostsByArticle } from "@/lib/repositories/social-posts-repository";
import { listRewriteSuggestionsBySocialPost } from "@/lib/repositories/social-rewrite-suggestions-repository";
import type { SocialPost } from "./social-platform-types";
import type { SocialPostRewriteSuggestion } from "./social-rewrite-types";
import type { Article } from "@/lib/types/domain";

export interface ArticleRewritePageData {
  article: Article | null;
  /** 원본(rewrite version이 아닌) social_post — 개선 제안의 대상/맥락 확인용. */
  originalPosts: SocialPost[];
  /** is_rewrite_version=true인 social_post만. */
  rewriteVersions: SocialPost[];
  suggestions: SocialPostRewriteSuggestion[];
}

/** rewrite suggestion과 rewrite version만 조회한다 (onlyRewriteVersions=true와 동일한 기본값). */
export async function buildArticleRewritePageData(articleId: string): Promise<ArticleRewritePageData> {
  const [article, allPosts] = await Promise.all([getArticleById(articleId), listSocialPostsByArticle(articleId)]);

  const originalPosts = allPosts.filter((post) => !post.isRewriteVersion);
  const rewriteVersions = allPosts.filter((post) => post.isRewriteVersion);

  const suggestionLists = await Promise.all(allPosts.map((post) => listRewriteSuggestionsBySocialPost(post.id)));
  const suggestions = suggestionLists.flat();

  return { article: article ?? null, originalPosts, rewriteVersions, suggestions };
}
