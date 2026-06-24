import Link from "next/link";
import { getArticleById } from "@/lib/repositories/article-repository";
import { getThemeById } from "@/lib/repositories/theme-repository";
import { getSourcesByArticleId } from "@/lib/repositories/source-repository";
import { getLatestEvalByArticleId } from "@/lib/repositories/eval-repository";
import { getLogsByArticleId } from "@/lib/harness/logger";
import type { ArticleStatus } from "@/lib/types/domain";
import { approveArticleAction, updateArticleAction } from "./actions";

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

export default async function ArticleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const article = await getArticleById(id);

  if (!article) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <Link href="/articles" className="text-sm text-zinc-500 hover:underline">
            ← 기사 목록으로
          </Link>
          <section className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
            기사를 찾을 수 없습니다 (id: {id}).
          </section>
        </div>
      </div>
    );
  }

  const [theme, sources, latestEval, logs] = await Promise.all([
    getThemeById(article.themeId),
    getSourcesByArticleId(article.id),
    getLatestEvalByArticleId(article.id),
    getLogsByArticleId(article.id, 10),
  ]);

  const isDraft = article.status === "draft";

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <Link href="/articles" className="text-sm text-zinc-500 hover:underline">
          ← 기사 목록으로
        </Link>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {latestEval && !latestEval.passed && (
          <div className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <div className="font-semibold">품질 검토 필요</div>
            <div className="mt-1 text-xs">
              이 기사는 AI 품질 평가를 통과하지 못했습니다 (종합 점수:{" "}
              {latestEval.aggregateScore != null ? latestEval.aggregateScore.toFixed(2) : "-"}).{" "}
              {latestEval.notes && latestEval.notes}
            </div>
          </div>
        )}

        <header className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">{article.title}</h1>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[article.status]}`}
          >
            {STATUS_LABEL[article.status]}
          </span>
        </header>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 text-sm shadow-sm">
          <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
            <span>
              테마:{" "}
              {theme ? (
                <Link href={`/dashboard?themeId=${theme.id}`} className="text-zinc-700 hover:underline">
                  {theme.title}
                </Link>
              ) : (
                "(알 수 없음)"
              )}
            </span>
            <span>생성일: {new Date(article.createdAt).toLocaleString("ko-KR")}</span>
            <span>수정일: {new Date(article.updatedAt).toLocaleString("ko-KR")}</span>
            {article.reviewedAt && (
              <span>승인일: {new Date(article.reviewedAt).toLocaleString("ko-KR")}</span>
            )}
            {article.reviewedBy && <span>승인자: {article.reviewedBy}</span>}
          </div>
        </section>

        {/* 기사 본문 / 수정 */}
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">기사 본문</h2>

          {isDraft ? (
            <form action={updateArticleAction} className="mt-3 flex flex-col gap-2">
              <input type="hidden" name="articleId" value={article.id} />
              <label className="flex flex-col gap-1 text-xs text-zinc-600">
                제목
                <input
                  name="title"
                  defaultValue={article.title}
                  required
                  className="rounded border border-zinc-300 px-2 py-1 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-600">
                본문
                <textarea
                  name="content"
                  defaultValue={article.content}
                  rows={16}
                  required
                  className="rounded border border-zinc-300 px-2 py-1 font-mono text-xs leading-relaxed"
                />
              </label>
              <div>
                <button
                  type="submit"
                  className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
                >
                  수정 내용 저장
                </button>
              </div>
            </form>
          ) : (
            <>
              <p className="mt-2 text-xs text-zinc-500">
                {STATUS_LABEL[article.status]} 상태인 기사는 수정할 수 없습니다.
              </p>
              <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-700">
                {article.content}
              </pre>
            </>
          )}
        </section>

        {/* 승인 */}
        {isDraft && (
          <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-700">승인</h2>
            <p className="mt-1 text-xs text-zinc-500">
              승인하면 기사 상태가 reviewed로 변경되고 더 이상 수정할 수 없습니다.
            </p>
            <form action={approveArticleAction} className="mt-3">
              <input type="hidden" name="articleId" value={article.id} />
              <button
                type="submit"
                className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-500"
              >
                승인하기
              </button>
            </form>
          </section>
        )}

        {/* 인용 출처 */}
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">인용된 출처 ({sources.length}개)</h2>
          {sources.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-500">연결된 출처가 없습니다.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {sources.map((source, index) => (
                <li key={source.id} className="rounded border border-zinc-200 px-3 py-2 text-sm">
                  <div className="font-medium">
                    {index + 1}.{" "}
                    <a href={source.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {source.title || "(제목 없음)"}
                    </a>
                  </div>
                  <div className="text-xs text-zinc-500">
                    {source.publisher && `${source.publisher}`}
                    {source.publishedAt && ` · ${source.publishedAt}`}
                  </div>
                  {source.summary && (
                    <p className="mt-1 line-clamp-2 text-xs text-zinc-600">
                      {source.summary.length > 150
                        ? `${source.summary.substring(0, 150)}…`
                        : source.summary}
                    </p>
                  )}
                  {source.keyPoints && source.keyPoints.length > 0 && (
                    <ul className="mt-1 list-inside list-disc text-xs text-zinc-500">
                      {source.keyPoints.slice(0, 3).map((kp, kpIdx) => (
                        <li key={kpIdx}>{kp}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 평가 결과 */}
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">최신 평가 결과 (AI Evals)</h2>
          {!latestEval ? (
            <p className="mt-2 text-xs text-zinc-500">아직 평가 결과가 없습니다.</p>
          ) : (
            <div className="mt-2 text-sm">
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    latestEval.passed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}
                >
                  {latestEval.passed ? "통과" : "미통과"}
                </span>
                <span className="text-xs text-zinc-500">
                  종합 점수:{" "}
                  {latestEval.aggregateScore != null ? latestEval.aggregateScore.toFixed(2) : "-"}
                </span>
              </div>
              <ul className="mt-2 flex flex-col gap-1 text-xs text-zinc-600">
                {Object.entries(latestEval.criteriaScores).map(([criterionId, score]) => (
                  <li key={criterionId}>
                    {criterionId}: {score.score}점 — {score.reason}
                  </li>
                ))}
              </ul>
              {latestEval.notes && <p className="mt-2 text-xs text-zinc-500">{latestEval.notes}</p>}
            </div>
          )}
        </section>

        {/* 파이프라인 로그 */}
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">관련 파이프라인 로그</h2>
          {logs.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-500">관련 로그가 없습니다.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1">
              {logs.map((log) => (
                <li key={log.id} className="flex items-start gap-2 rounded px-2 py-1 text-xs">
                  <span
                    className={`mt-0.5 inline-block rounded-full px-1.5 py-0.5 font-medium ${
                      log.status === "failed"
                        ? "bg-red-100 text-red-700"
                        : log.status === "success"
                          ? "bg-green-100 text-green-700"
                          : "bg-zinc-100 text-zinc-700"
                    }`}
                  >
                    {log.type}
                  </span>
                  <span className="text-zinc-600">{log.message}</span>
                  <span className="ml-auto shrink-0 text-zinc-400">
                    {new Date(log.createdAt).toLocaleTimeString("ko-KR")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
