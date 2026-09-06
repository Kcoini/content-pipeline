import Link from "next/link";
import { getArticles, getArticleRelatedCounts } from "@/lib/repositories/article-repository";
import { getThemes } from "@/lib/repositories/theme-repository";
import { getLatestEvalByArticleId } from "@/lib/repositories/eval-repository";
import type { ArticleStatus } from "@/lib/types/domain";
import { TransientNotice } from "@/components/ui/transient-notice";
import { ConfirmSubmitButton } from "@/app/articles/[id]/confirm-submit-button";
import { archiveArticleAction } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<ArticleStatus, string> = {
  draft: "초안 (draft)",
  reviewed: "승인됨 (reviewed)",
  published: "게시됨 (published)",
};

const STATUS_STYLE: Record<ArticleStatus, string> = {
  draft: "bg-amber-100 text-amber-700",
  reviewed: "bg-green-100 text-green-700",
  published: "bg-blue-100 text-blue-700",
};

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ deleteMessage?: string; deleteError?: string }>;
}) {
  const { deleteMessage, deleteError } = await searchParams;
  const [articles, themes] = await Promise.all([getArticles(), getThemes()]);
  const themeTitleMap = new Map(themes.map((theme) => [theme.id, theme.title]));
  const evalRuns = await Promise.all(
    articles.map((article) => getLatestEvalByArticleId(article.id))
  );
  const relatedCounts = await Promise.all(
    articles.map((article) => getArticleRelatedCounts(article.id))
  );

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">기사 목록</h1>
            <p className="mt-1 text-sm text-zinc-600">
              생성된 기사 초안을 검토, 수정, 승인할 수 있습니다.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          >
            대시보드로 이동
          </Link>
        </header>

        <TransientNotice message={deleteMessage} variant="success" />
        <TransientNotice message={deleteError} variant="error" />

        {articles.length === 0 ? (
          <section className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
            아직 생성된 기사가 없습니다. 대시보드에서 기사 초안을 생성해 보세요.
          </section>
        ) : (
          <ul className="flex flex-col gap-3">
            {articles.map((article, index) => {
              const evalRun = evalRuns[index];
              const counts = relatedCounts[index];
              const confirmMessage = [
                "이 기사를 삭제하시겠습니까?",
                "",
                `연결된 블로그 글/소셜 글 ${counts.socialPostCount}개가 있습니다.`,
                counts.hasWordPressPost
                  ? "이미 WordPress에 생성된 Draft/Post가 있습니다."
                  : "",
                "연결된 블로그 글, 소셜 글, 승인 상태, 게시 준비 상태가 함께 영향을 받을 수 있습니다.",
                "WordPress에 생성된 Draft/Post는 자동 삭제되지 않습니다. 이 작업은 앱 내부 데이터만 삭제합니다.",
              ]
                .filter(Boolean)
                .join("\n");

              return (
                <li key={article.id} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-400">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/articles/${article.id}`} className="block flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="text-base font-semibold">{article.title}</h2>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[article.status]}`}
                        >
                          {STATUS_LABEL[article.status]}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">
                        테마: {themeTitleMap.get(article.themeId) ?? "(알 수 없음)"}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                        <span>
                          평가 점수:{" "}
                          {evalRun?.aggregateScore != null
                            ? evalRun.aggregateScore.toFixed(2)
                            : "평가 없음"}
                        </span>
                        <span>생성일: {new Date(article.createdAt).toLocaleString("ko-KR")}</span>
                      </div>
                    </Link>
                    <form action={archiveArticleAction} className="shrink-0">
                      <input type="hidden" name="articleId" value={article.id} />
                      <ConfirmSubmitButton
                        confirmMessage={confirmMessage}
                        className="rounded border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-400 hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                      >
                        삭제
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
