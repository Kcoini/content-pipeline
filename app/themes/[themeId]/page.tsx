// Phase 1-13: 테마 기반 관련 기사 URL 후보 수집 및 출처 등록 페이지.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getThemeById } from "@/lib/repositories/theme-repository";
import { getArticleUrlCandidates } from "@/lib/article-search/article-search-service";
import { collectCandidates, importCandidatesToSources, dismissCandidate } from "./actions";
import type { ArticleUrlCandidate } from "@/lib/types/domain";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  candidate: "후보",
  selected: "선택됨",
  dismissed: "제외됨",
  imported: "등록됨",
};

function PlatformBadge({ platform }: { platform: string }) {
  const map: Record<string, string> = {
    naver: "bg-green-100 text-green-700",
    daum: "bg-blue-100 text-blue-700",
    mock: "bg-zinc-100 text-zinc-600",
  };
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${map[platform] ?? "bg-zinc-100 text-zinc-600"}`}>
      {platform}
    </span>
  );
}

function CandidateCard({ candidate }: { candidate: ArticleUrlCandidate }) {
  const isImported = candidate.status === "imported";
  const isDismissed = candidate.status === "dismissed";

  return (
    <div className={`rounded-lg border p-3 text-sm ${isImported ? "border-green-200 bg-green-50" : isDismissed ? "border-zinc-200 bg-zinc-50 opacity-50" : "border-zinc-200 bg-white"}`}>
      <div className="flex items-start gap-2">
        {/* 체크박스 (import 가능한 후보만) */}
        {!isImported && !isDismissed && (
          <input
            type="checkbox"
            name="candidateIds"
            value={candidate.id}
            className="mt-0.5 shrink-0 accent-blue-600"
          />
        )}
        {(isImported || isDismissed) && <span className="mt-0.5 shrink-0 w-4" />}

        <div className="min-w-0 flex-1">
          <p className="font-medium text-zinc-900 leading-snug">
            {candidate.title ?? "(제목 없음)"}
          </p>
          {candidate.snippet && (
            <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">{candidate.snippet}</p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <PlatformBadge platform={candidate.platform} />
            {candidate.publisher && (
              <span className="text-xs text-zinc-500">{candidate.publisher}</span>
            )}
            {candidate.rankPosition != null && (
              <span className="text-xs text-zinc-400">#{candidate.rankPosition}</span>
            )}
            <span className="text-xs rounded bg-zinc-100 px-1 py-0.5 text-zinc-500">
              {STATUS_LABEL[candidate.status] ?? candidate.status}
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-blue-600">
            <a href={candidate.url} target="_blank" rel="noopener noreferrer">
              {candidate.url}
            </a>
          </p>
        </div>

        {/* 제외 버튼: form은 import form 밖에 별도로 렌더링되며 form= 속성으로 연결 */}
        {!isImported && !isDismissed && (
          <button
            type="submit"
            form={`dismiss-${candidate.id}`}
            className="shrink-0 rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100"
          >
            제외
          </button>
        )}
      </div>
    </div>
  );
}

export default async function ThemePage({
  params,
}: {
  params: Promise<{ themeId: string }>;
}) {
  const { themeId } = await params;
  const theme = await getThemeById(themeId);

  if (!theme) notFound();

  const candidates = await getArticleUrlCandidates(themeId);

  const activeCandidates = candidates.filter((c) => c.status === "candidate");
  const importedCandidates = candidates.filter((c) => c.status === "imported");
  const dismissedCandidates = candidates.filter((c) => c.status === "dismissed");

  const isMockMode = process.env.ARTICLE_SEARCH_ENABLED !== "true";

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto max-w-4xl">
        {/* 헤더 */}
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">{theme.title}</h1>
            <p className="mt-0.5 text-sm text-zinc-600">{theme.description}</p>
            {theme.keywords.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {theme.keywords.map((kw) => (
                  <span key={kw} className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs text-zinc-600">
                    {kw}
                  </span>
                ))}
              </div>
            )}
          </div>
          <Link
            href={`/dashboard?themeId=${themeId}`}
            className="shrink-0 rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          >
            ← 대시보드
          </Link>
        </header>

        {isMockMode && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
            <strong>Mock 모드</strong> — ARTICLE_SEARCH_ENABLED=false. 실제 API 대신 mock 후보를 생성합니다.
          </div>
        )}

        {/* 수집 버튼 */}
        <form
          action={async () => {
            "use server";
            await collectCandidates(themeId);
          }}
          className="mb-6"
        >
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700"
          >
            관련 기사 URL 후보 수집
          </button>
          <p className="mt-1 text-xs text-zinc-500">
            테마 키워드({theme.keywords.slice(0, 3).join(", ")})로 관련 기사 URL을 자동 수집합니다.
          </p>
        </form>

        {/* 후보 목록 + 일괄 등록 폼 */}
        {candidates.length > 0 && (
          <form
            action={async (formData: FormData) => {
              "use server";
              await importCandidatesToSources(formData);
            }}
            className="mb-6"
          >
            <input type="hidden" name="themeId" value={themeId} />

            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-800">
                기사 URL 후보{" "}
                <span className="font-normal text-zinc-500">
                  (전체 {candidates.length}건 · 후보 {activeCandidates.length}건 · 등록됨 {importedCandidates.length}건)
                </span>
              </h2>
              {activeCandidates.length > 0 && (
                <button
                  type="submit"
                  className="rounded-md border border-blue-300 bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
                >
                  선택한 후보 출처 등록
                </button>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {candidates
                .filter((c) => c.status !== "dismissed")
                .map((c) => (
                  <CandidateCard key={c.id} candidate={c} />
                ))}
            </div>

            {dismissedCandidates.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-zinc-400">
                  제외된 후보 {dismissedCandidates.length}건 보기
                </summary>
                <div className="mt-2 flex flex-col gap-2">
                  {dismissedCandidates.map((c) => (
                    <CandidateCard key={c.id} candidate={c} />
                  ))}
                </div>
              </details>
            )}
          </form>
        )}

        {candidates.length === 0 && (
          <p className="rounded-lg border border-dashed border-zinc-300 py-10 text-center text-sm text-zinc-500">
            수집된 URL 후보가 없습니다. 위 버튼을 눌러 수집하세요.
          </p>
        )}

        {importedCandidates.length > 0 && (
          <p className="text-center text-sm text-zinc-600">
            등록된 출처 {importedCandidates.length}건 →{" "}
            <Link href={`/dashboard?themeId=${themeId}`} className="text-blue-600 hover:underline">
              대시보드에서 확인
            </Link>
          </p>
        )}

        {/* 제외 form들: import form 밖에 위치. CandidateCard button의 form= 속성으로 연결된다. */}
        {activeCandidates.map((c) => (
          <form
            key={`dismiss-form-${c.id}`}
            id={`dismiss-${c.id}`}
            action={async () => {
              "use server";
              await dismissCandidate(c.id);
              redirect(`/themes/${themeId}`);
            }}
          />
        ))}
      </div>
    </div>
  );
}
