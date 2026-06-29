// Phase 1-12/13: 자동 공통 테마 추출 페이지.
// 트렌드 후보 수집 → 클러스터링 → 사용자 선택 → themes 저장 흐름을 담당한다.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getTrendPageData, isTrendEnabled, isNaverKeySet, isDaumKeySet } from "@/lib/trends/trend-service";
import { runTrendCollection, selectClusterAsTheme } from "./actions";
import type { TrendCandidate, ThemeCluster } from "@/lib/types/domain";

export const dynamic = "force-dynamic";

function PlatformBadge({ platform }: { platform: string }) {
  const colorMap: Record<string, string> = {
    naver: "bg-green-100 text-green-700",
    daum: "bg-blue-100 text-blue-700",
    mock: "bg-zinc-100 text-zinc-600",
  };
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${colorMap[platform] ?? "bg-zinc-100 text-zinc-600"}`}>
      {platform}
    </span>
  );
}

function KeyStatus({ label, set }: { label: string; set: boolean }) {
  return (
    <span className={`flex items-center gap-1 text-xs ${set ? "text-green-700" : "text-zinc-400"}`}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${set ? "bg-green-500" : "bg-zinc-300"}`} />
      {label}: {set ? "설정됨" : "미설정"}
    </span>
  );
}

function CandidateRow({ candidate }: { candidate: TrendCandidate }) {
  return (
    <li className="flex items-start gap-3 border-b border-zinc-100 py-2 last:border-0">
      <PlatformBadge platform={candidate.platform} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-800">
          {candidate.title ?? candidate.keyword ?? "(제목 없음)"}
        </p>
        {candidate.snippet && (
          <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">{candidate.snippet}</p>
        )}
      </div>
      {candidate.rankPosition != null && (
        <span className="shrink-0 text-xs text-zinc-400">#{candidate.rankPosition}</span>
      )}
    </li>
  );
}

function ClusterCard({ cluster }: { cluster: ThemeCluster }) {
  const isSelected = cluster.status === "selected";
  const isDismissed = cluster.status === "dismissed";

  return (
    <div className={`rounded-lg border p-4 ${isSelected ? "border-green-300 bg-green-50" : isDismissed ? "border-zinc-200 bg-zinc-50 opacity-60" : "border-zinc-200 bg-white"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-zinc-900">{cluster.title}</h3>
          <p className="mt-0.5 text-sm text-zinc-600">{cluster.description}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-bold text-zinc-800">{cluster.score}</p>
          <p className="text-xs text-zinc-500">점수</p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {cluster.keywords.map((kw) => (
          <span key={kw} className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">{kw}</span>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-4 text-xs text-zinc-500">
        <span>네이버 {cluster.naverCount}건</span>
        <span>다음 {cluster.daumCount}건</span>
        <span className="ml-auto capitalize rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-600">
          {cluster.status}
        </span>
      </div>

      {!isSelected && !isDismissed && (
        <form
          action={async () => {
            "use server";
            const result = await selectClusterAsTheme(cluster.id);
            if (result.success && result.data) {
              const { themeId } = result.data as { themeId: string };
              redirect(`/dashboard?themeId=${themeId}`);
            }
          }}
          className="mt-3"
        >
          <button
            type="submit"
            className="w-full rounded border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
          >
            이 테마로 기사 작성 시작 →
          </button>
        </form>
      )}

      {isSelected && (
        <p className="mt-3 text-center text-xs font-medium text-green-700">✓ 테마로 저장됨</p>
      )}
    </div>
  );
}

type CollectionStatus = "success" | "failed" | "skipped";

function PlatformStatus({
  label,
  status,
  count,
  error,
}: {
  label: string;
  status: CollectionStatus;
  count: number;
  error?: string;
}) {
  if (status === "skipped") return null;
  const isOk = status === "success";
  return (
    <span className={`flex items-center gap-1 text-xs ${isOk ? "text-green-700" : "text-red-600"}`}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${isOk ? "bg-green-500" : "bg-red-400"}`} />
      {label}: {isOk ? `성공 (${count}건)` : `실패${error ? ` — ${error}` : ""}`}
    </span>
  );
}

export default async function TrendsPage({
  searchParams,
}: {
  searchParams: Promise<{
    msg?: string;
    type?: string;
    naverStatus?: string;
    daumStatus?: string;
    naverCount?: string;
    daumCount?: string;
    naverError?: string;
    daumError?: string;
  }>;
}) {
  const {
    msg,
    type,
    naverStatus,
    daumStatus,
    naverCount: lastNaverCount,
    daumCount: lastDaumCount,
    naverError,
    daumError,
  } = await searchParams;
  const { candidates, clusters } = await getTrendPageData();

  // 서버 컴포넌트에서 안전하게 key 설정 여부만 확인 (값 자체는 노출하지 않음)
  const mockMode = !isTrendEnabled();
  const naverSet = isNaverKeySet();
  const daumSet = isDaumKeySet();

  const naverCount = candidates.filter((c) => c.platform === "naver").length;
  const daumCount = candidates.filter((c) => c.platform === "daum").length;
  const mockCount = candidates.filter((c) => c.platform === "mock").length;

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">자동 공통 테마 추출</h1>
            <p className="mt-1 text-sm text-zinc-600">
              포털 트렌드에서 공통 주제를 찾아 기사 테마로 바로 활용합니다.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="shrink-0 rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          >
            ← 대시보드
          </Link>
        </header>

        {/* 모드 + API key 상태 표시 */}
        <div className="mb-4 flex flex-wrap items-center gap-4 rounded-lg border border-zinc-200 bg-white px-4 py-3">
          <span className={`rounded px-2 py-0.5 text-xs font-semibold ${mockMode ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
            {mockMode ? "Mock 모드" : "Real API 모드"}
          </span>
          {!mockMode && (
            <>
              <KeyStatus label="네이버" set={naverSet} />
              <KeyStatus label="다음(카카오)" set={daumSet} />
            </>
          )}
          {mockMode && (
            <span className="text-xs text-zinc-500">
              TREND_COLLECTION_ENABLED=false — 실제 API 대신 샘플 데이터를 사용합니다.
            </span>
          )}
          {candidates.length > 0 && (
            <span className="ml-auto text-xs text-zinc-500">
              {naverCount > 0 && `네이버 ${naverCount}건`}
              {naverCount > 0 && daumCount > 0 && " · "}
              {daumCount > 0 && `다음 ${daumCount}건`}
              {mockCount > 0 && `mock ${mockCount}건`}
            </span>
          )}
        </div>

        {/* 수집 결과 메시지 */}
        {msg && (
          <div className={`mb-3 rounded-md border px-4 py-2 text-sm ${type === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"}`}>
            {msg}
          </div>
        )}

        {/* 플랫폼별 수집 결과 상태 */}
        {(naverStatus || daumStatus) && naverStatus !== "skipped" && (
          <div className="mb-4 flex flex-wrap items-center gap-4 rounded-md border border-zinc-200 bg-white px-4 py-2.5">
            <span className="text-xs font-medium text-zinc-600">최근 수집 결과</span>
            {naverStatus && (
              <PlatformStatus
                label="네이버"
                status={naverStatus as CollectionStatus}
                count={Number(lastNaverCount ?? 0)}
                error={naverError}
              />
            )}
            {daumStatus && (
              <PlatformStatus
                label="다음(카카오)"
                status={daumStatus as CollectionStatus}
                count={Number(lastDaumCount ?? 0)}
                error={daumError}
              />
            )}
          </div>
        )}

        {/* Real API 모드에서 key 미설정 경고 */}
        {!mockMode && (!naverSet || !daumSet) && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
            {!naverSet && <p>네이버 API key가 설정되지 않았습니다. .env.local에 NAVER_CLIENT_ID, NAVER_CLIENT_SECRET을 추가하세요.</p>}
            {!daumSet && <p>카카오 API key가 설정되지 않았습니다. .env.local에 KAKAO_REST_API_KEY를 추가하세요.</p>}
          </div>
        )}

        {/* 수집 버튼 */}
        <form action={runTrendCollection} className="mb-8">
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700"
          >
            트렌드 수집 + 공통 테마 추출 실행
          </button>
          <p className="mt-1 text-xs text-zinc-500">
            {mockMode
              ? "mock 데이터로 트렌드 후보를 수집하고 공통 테마를 추출합니다."
              : "네이버/다음 API로 뉴스를 검색하고 공통 테마를 추출합니다."}
          </p>
        </form>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.5fr]">
          {/* 수집된 후보 */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-zinc-800">
              수집된 트렌드 후보{" "}
              <span className="font-normal text-zinc-500">({candidates.length}건)</span>
            </h2>
            {candidates.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-300 py-8 text-center text-sm text-zinc-500">
                수집된 후보가 없습니다. 위 버튼을 눌러 수집하세요.
              </p>
            ) : (
              <ul className="rounded-lg border border-zinc-200 bg-white px-4 py-2">
                {candidates.slice(0, 20).map((c) => (
                  <CandidateRow key={c.id} candidate={c} />
                ))}
                {candidates.length > 20 && (
                  <li className="py-2 text-center text-xs text-zinc-400">
                    외 {candidates.length - 20}건
                  </li>
                )}
              </ul>
            )}
          </section>

          {/* 공통 테마 클러스터 */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-zinc-800">
              공통 테마 후보{" "}
              <span className="font-normal text-zinc-500">({clusters.length}건, 점수 높은 순)</span>
            </h2>
            {clusters.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-300 py-8 text-center text-sm text-zinc-500">
                추출된 공통 테마가 없습니다. 트렌드를 먼저 수집하세요.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {clusters.map((cluster) => (
                  <ClusterCard key={cluster.id} cluster={cluster} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
