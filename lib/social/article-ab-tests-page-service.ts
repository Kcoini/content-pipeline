// Phase 3-20: A/B Testing Draft Structure.
// /articles/[id]/ab-tests 페이지 전용 데이터 조회. 이 파일의 어떤
// 함수도 데이터를 변경하지 않는다(read-only) — draft 생성/상태 전환은
// app/articles/[id]/actions.ts의 서버 액션이 담당한다.

import { getArticleById } from "@/lib/repositories/article-repository";
import { listSocialPostsByArticle } from "@/lib/repositories/social-posts-repository";
import { listAbTestsByArticle, listVariantsByAbTest } from "@/lib/repositories/social-ab-tests-repository";
import type { SocialAbTest, SocialAbTestVariant } from "./social-ab-testing-types";
import type { SocialPost } from "./social-platform-types";
import type { Article } from "@/lib/types/domain";

export interface ArticleAbTestListEntry {
  abTest: SocialAbTest;
  variants: SocialAbTestVariant[];
}

export interface ArticleAbTestsPageData {
  article: Article | null;
  /** A/B test 목록(최신순) + 각 테스트의 variant 목록. */
  abTests: ArticleAbTestListEntry[];
  /** "원본 vs Rewrite" 생성 폼에서 고를 원본/rewrite 후보 (전체 social_post 목록). */
  allPosts: SocialPost[];
}

/** article 하나에 속한 A/B test draft 목록(+variant)과 후보 social_post 목록을 조회한다. */
export async function buildArticleAbTestsPageData(articleId: string): Promise<ArticleAbTestsPageData> {
  const [article, tests, allPosts] = await Promise.all([
    getArticleById(articleId),
    listAbTestsByArticle(articleId),
    listSocialPostsByArticle(articleId),
  ]);

  const abTests = await Promise.all(
    tests.map(async (abTest) => ({ abTest, variants: await listVariantsByAbTest(abTest.id) }))
  );

  return { article: article ?? null, abTests, allPosts };
}
