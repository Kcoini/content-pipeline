import Link from "next/link";
import { getArticles } from "@/lib/repositories/article-repository";
import { getThemes } from "@/lib/repositories/theme-repository";
import { getLatestEvalByArticleId } from "@/lib/repositories/eval-repository";
import type { ArticleStatus } from "@/lib/types/domain";

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

export default async function ArticlesPage() {
  const [articles, themes] = await Promise.all([getArticles(), getThemes()]);
  const themeTitleMap = new Map(themes.map((theme) => [theme.id, theme.title]));
  const evalRuns = await Promise.all(
    articles.map((article) => getLatestEvalByArticleId(article.id))
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

        {articles.length === 0 ? (
          <section className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
            아직 생성된 기사가 없습니다. 대시보드에서 기사 초안을 생성해 보세요.
          </section>
        ) : (
          <ul className="flex flex-col gap-3">
            {articles.map((article, index) => {
              const evalRun = evalRuns[index];

              return (
                <li key={article.id}>
                  <Link
                    href={`/articles/${article.id}`}
                    className="block rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-400"
                  >
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
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
