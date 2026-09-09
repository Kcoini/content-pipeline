import Link from "next/link";
import { notFound } from "next/navigation";
import { buildArticleAbTestsPageData } from "@/lib/social/article-ab-tests-page-service";
import { ArticleWorkflowNavigation } from "@/components/articles/article-workflow-navigation";
import { DeepLinkNotice } from "@/components/navigation/deep-link-highlight";
import { AbTestList } from "@/components/social-ab-tests/ab-test-list";
import { CreateAbTestForm } from "@/components/social-ab-tests/create-ab-test-form";
import { OriginalVsRewriteTestForm } from "@/components/social-ab-tests/original-vs-rewrite-test-form";

export const dynamic = "force-dynamic";

export default async function ArticleAbTestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    publishMessage?: string;
    abTestId?: string;
    originalSocialPostId?: string;
    rewriteSocialPostId?: string;
    returnTo?: string;
  }>;
}) {
  const { id } = await params;
  const { error, publishMessage, abTestId: targetAbTestId, originalSocialPostId, rewriteSocialPostId, returnTo } = await searchParams;

  const { article, abTests, allPosts } = await buildArticleAbTestsPageData(id);

  if (!article) {
    notFound();
  }

  const targetFound = targetAbTestId ? abTests.some((entry) => entry.abTest.id === targetAbTestId) : true;

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <Link href={`/articles/${id}`} className="text-sm text-zinc-500 hover:underline">
          ← 기사 개요로
        </Link>

        <ArticleWorkflowNavigation articleId={id} active="ab-tests" returnTo={returnTo} />

        {/* Phase 3-24: 영어 용어(A/B Test/Variant/Winner 등)를 한국어로
            바꿨다 — 이 화면은 같은 주제의 글을 서로 비교해 어떤 문체와
            플랫폼이 더 반응이 좋은지 확인하는 곳이다. */}
        <div className="rounded border border-purple-200 bg-purple-50 px-3 py-2 text-xs text-purple-800">
          <p>
            글 반응 비교 관리 페이지입니다. 같은 주제의 글을 서로 비교해 어떤 문체와 플랫폼이 더 반응이 좋은지
            확인할 수 있습니다 — 실제 자동 비교 게시가 아니라 비교 실험 계획/비교 글 구조를 준비하는 단계입니다.
          </p>
          <p>비교에 포함된 모든 글은 기존 승인/export/수동 게시 준비/수동 게시 흐름을 그대로 거쳐야 게시됩니다.</p>
          <p>
            결과는 수동으로 입력한 조회수/클릭/반응 기반이며, 동일 조건의 비교 실험이 아닐 수 있으므로 참고
            지표로만 사용하세요.
          </p>
        </div>

        {targetAbTestId && <DeepLinkNotice targetId={targetAbTestId} found={targetFound} />}

        {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {publishMessage && <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">{publishMessage}</div>}

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h1 className="text-lg font-semibold">{article.title}</h1>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">비교 실험 만들기</h2>
          <CreateAbTestForm articleId={id} returnTo={returnTo} />
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">원본과 재작성 글 비교 실험 만들기</h2>
          <p className="mt-1 text-[11px] text-zinc-500">원본과 재작성 버전을 곧바로 기준 글/비교 글로 묶어 비교 실험을 만듭니다.</p>
          <OriginalVsRewriteTestForm
            articleId={id}
            allPosts={allPosts}
            defaultOriginalSocialPostId={originalSocialPostId}
            defaultRewriteSocialPostId={rewriteSocialPostId}
            returnTo={returnTo}
          />
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">비교 실험 목록 ({abTests.length})</h2>
          <AbTestList articleId={id} entries={abTests} returnTo={returnTo} highlightAbTestId={targetAbTestId} />
        </section>
      </div>
    </div>
  );
}
