// Phase 1-12: 자동 공통 테마 추출 페이지.
// 트렌드 후보 수집 → 클러스터링 → 사용자 선택 → themes 저장 흐름을 담당한다.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getTrendPageData } from "@/lib/trends/trend-service";
import { runTrendCollection, selectClusterAsTheme } from "./actions";
import type { TrendCandidate, ThemeCluster } from "@/lib/types/domain";
// selectClusterAsTheme은 ClusterCard 내 inline server action에서 직접 사용

export const dynamic = "force-dynamic";

function PlatformBadge({ platform }: { platform: string }) {
  const colorMap: Record<string, string> = {
    naver: "bg-green-100 text-green-700",
    daum: "bg-blue-100 text-blue-700",
    mock: "bg-zinc-100 text-zinc-600",
  };
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${colorMap[platform] ?? "bg-zinc-100 text-zinc-600"}`}
    >
      {platform}
    </span>
  );
}

function CandidateRow({ candidate }: { candidate: TrendCandidate }) {
  return (
    <li className="flex items-start gap-3 border-b border-zinc-100 py-2 last:border-0">
      <PlatformBadge platform={candidate.platform} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-800 truncate">
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
    <div
      className={`rounded-lg border p-4 ${
        isSelected
          ? "border-green-300 bg-green-50"
          : isDismissed
            ? "border-zinc-200 bg-zinc-50 opacity-60"
            : "border-zinc-200 bg-white"
      }`}
    >
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
          <span
            key={kw}
            className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600"
          >
            {kw}
          </span>
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
        <p className="mt-3 text-center text-xs font-medium text-green-700">
          ✓ 테마로 저장됨
        </p>
      )}
    </div>
  );
}

export default async function TrendsPage() {
  const { candidates, clusters } = await getTrendPageData();

  const isMockMode = process.env.TREND_COLLECTION_ENABLED !== "true";

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

        {isMockMode && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
            <strong>Mock 모드</strong> — TREND_COLLECTION_ENABLED=false. 실제 API 대신 샘플
            데이터를 사용합니다.
          </div>
        )}

        {/* 수집 버튼 */}
        <form
          action={async () => {
            "use server";
            await runTrendCollection();
          }}
          className="mb-8"
        >
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700"
          >
            트렌드 수집 + 공통 테마 추출 실행
          </button>
          <p className="mt-1 text-xs text-zinc-500">
            버튼을 누르면 트렌드 후보를 수집하고 공통 테마 후보를 자동으로 추출합니다.
          </p>
        </form>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.5fr]">
          {/* 왼쪽: 수집된 후보 */}
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

          {/* 오른쪽: 공통 테마 클러스터 */}
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
                  <ClusterCard
                    key={cluster.id}
                    cluster={cluster}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
