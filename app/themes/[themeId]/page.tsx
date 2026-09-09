// Phase 1-13: 테마 기반 관련 기사 URL 후보 수집 및 출처 등록 페이지.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getThemeById } from "@/lib/repositories/theme-repository";
import { getArticleUrlCandidates } from "@/lib/article-search/article-search-service";
import { getSourcesByThemeId } from "@/lib/repositories/source-repository";
import { summarizeSourceStatus } from "@/lib/dashboard/source-display";
import {
  collectCandidates,
  importCandidatesToSources,
  dismissCandidate,
  finishUrlCollection,
  goDashboardFromUrlCollection,
  goGenerateFromUrlCollection,
} from "./actions";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import {
  RelatedUrlCollectionResultCard,
  type CollectionResultStatus,
} from "@/components/sources/related-url-collection-result-card";
import type { ArticleUrlCandidate } from "@/lib/types/domain";

export const dynamic = "force-dynamic";

/** 대시보드(`app/dashboard/page.tsx`)와 동일한 기준값 — 글 생성에 필요한 최소 출처 수. */
const MIN_SOURCE_COUNT = 3;

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
  searchParams,
}: {
  params: Promise<{ themeId: string }>;
  searchParams: Promise<{
    collectStatus?: string;
    collectNew?: string;
    collectDup?: string;
    collectError?: string;
  }>;
}) {
  const { themeId } = await params;
  const { collectStatus, collectNew, collectDup, collectError } = await searchParams;
  const theme = await getThemeById(themeId);

  if (!theme) notFound();

  const candidates = await getArticleUrlCandidates(themeId);
  const sources = await getSourcesByThemeId(themeId);
  const sourceStatus = summarizeSourceStatus(sources, MIN_SOURCE_COUNT);

  const activeCandidates = candidates.filter((c) => c.status === "candidate");
  const importedCandidates = candidates.filter((c) => c.status === "imported");
  const dismissedCandidates = candidates.filter((c) => c.status === "dismissed");

  // Phase 3-27: "관련 기사 URL 수집" 버튼 실행 결과를 항상 화면에
  // 보여준다(무반응 방지). action이 redirect로 넘긴 query만 신뢰하고,
  // 유효하지 않은 값이면 결과 카드를 아예 보여주지 않는다.
  const VALID_COLLECT_STATUSES: readonly CollectionResultStatus[] = ["success", "partial", "none", "error", "finished"];
  const resolvedCollectStatus: CollectionResultStatus | null = VALID_COLLECT_STATUSES.includes(
    collectStatus as CollectionResultStatus
  )
    ? (collectStatus as CollectionResultStatus)
    : null;

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

        {/* 수집 버튼 — Phase 3-27: 결과를 항상 아래 결과 카드로 보여주므로
            (무반응 방지), 결과 카드가 있으면 이 버튼은 "다시 처음부터
            수집"용으로 보이도록 결과 카드 바로 위에 배치한다. */}
        <form id="collect-form" action={collectCandidates} className="mb-6 scroll-mt-4">
          <input type="hidden" name="themeId" value={themeId} />
          <input type="hidden" name="trigger" value="initial" />
          <PendingSubmitButton
            pendingLabel="관련 기사 URL을 수집하고 있습니다..."
            className="rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            관련 기사 URL 후보 수집
          </PendingSubmitButton>
          <p className="mt-1 text-xs text-zinc-500">
            테마 키워드({theme.keywords.slice(0, 3).join(", ")})로 관련 기사 URL을 자동 수집합니다. 수집 중에는 잠시만
            기다려 주세요.
          </p>
        </form>

        {resolvedCollectStatus && (
          <div className="mb-6 scroll-mt-4">
            <RelatedUrlCollectionResultCard
              themeId={themeId}
              status={resolvedCollectStatus}
              newCount={Number(collectNew ?? 0) || 0}
              duplicateCount={Number(collectDup ?? 0) || 0}
              candidateCounts={{
                pending: activeCandidates.length,
                imported: importedCandidates.length,
                dismissed: dismissedCandidates.length,
              }}
              sourceStatus={sourceStatus}
              errorMessage={collectError ?? null}
              hasCollectedCandidates={candidates.length > 0}
              collectMoreAction={collectCandidates}
              finishCollectionAction={finishUrlCollection}
              goDashboardAction={goDashboardFromUrlCollection}
              goGenerateAction={goGenerateFromUrlCollection}
            />
          </div>
        )}

        {/* 후보 목록 + 일괄 등록 폼 — "수집한 URL 확인" 링크가 여기로 이동한다. */}
        {candidates.length > 0 && (
          <form
            id="candidate-list"
            action={async (formData: FormData) => {
              "use server";
              await importCandidatesToSources(formData);
            }}
            className="mb-6 scroll-mt-4"
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
