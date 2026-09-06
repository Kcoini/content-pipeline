// Phase 1-12/13: 자동 공통 테마 추출 페이지.
// 트렌드 후보 수집 → 클러스터링 → 사용자 선택 → themes 저장 흐름을 담당한다.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getTrendPageData, isTrendEnabled, isNaverKeySet, isDaumKeySet } from "@/lib/trends/trend-service";
import { groupThemeClustersForDisplay, type DisplayThemeCluster } from "@/lib/trends/theme-cluster-display";
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

/**
 * 원자료(raw trend) 후보 한 줄 — compact 표시. 이 화면의 핵심 작업은
 * "공통 테마 후보 선택"이므로, 원자료는 근거 확인용으로만 쓴다: 배지 +
 * 제목 + 순위만 기본으로 보여주고, 긴 요약문은 "요약 보기"를 열어야
 * 확인할 수 있다(raw 데이터 자체는 그대로 두고 표시만 compact하게 한다).
 */
function CandidateRow({ candidate }: { candidate: TrendCandidate }) {
  return (
    <li className="border-b border-zinc-100 py-1.5 last:border-0">
      <div className="flex items-center gap-2">
        <PlatformBadge platform={candidate.platform} />
        <p className="min-w-0 flex-1 truncate break-keep text-sm font-medium text-zinc-800">
          {candidate.title ?? candidate.keyword ?? "(제목 없음)"}
        </p>
        {candidate.rankPosition != null && (
          <span className="shrink-0 text-xs text-zinc-400">#{candidate.rankPosition}</span>
        )}
      </div>
      {candidate.snippet && (
        <details className="mt-0.5 pl-[3.25rem]">
          <summary className="cursor-pointer select-none text-xs text-blue-600 hover:text-blue-800">
            요약 보기
          </summary>
          <p className="mt-0.5 break-keep text-xs leading-relaxed text-zinc-500">{candidate.snippet}</p>
        </details>
      )}
    </li>
  );
}

const MAX_VISIBLE_SUBTOPICS = 3;

/** 병합된 후보 하나의 요약 정보 — "이 테마로 기사 작성 시작" 버튼은 표시하지 않는다. */
function MergedCandidateRow({ candidate }: { candidate: ThemeCluster }) {
  return (
    <li className="rounded border border-zinc-200 bg-white px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 break-keep text-sm font-medium text-zinc-700">{candidate.title}</p>
        <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-semibold text-zinc-600">
          점수 {candidate.score}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-600">병합된 후보</span>
        <span>네이버 {candidate.naverCount}건</span>
        <span>다음 {candidate.daumCount}건</span>
        <span>반복 발견 {candidate.seenCount}회</span>
        <span>마지막 발견: {new Date(candidate.lastSeenAt).toLocaleString("ko-KR")}</span>
      </div>
      {candidate.keywords.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {candidate.keywords.map((kw) => (
            <span key={kw} className="rounded bg-zinc-50 px-1.5 py-0.5 text-xs text-zinc-500">{kw}</span>
          ))}
        </div>
      )}
      {candidate.subtopics.length > 0 && (
        <p className="mt-1 w-full break-keep text-xs leading-relaxed text-zinc-500">
          하위 주제: {candidate.subtopics.join(", ")}
        </p>
      )}
    </li>
  );
}

function ClusterCard({ group }: { group: DisplayThemeCluster }) {
  const {
    representative,
    mergedCandidates,
    aggregatedNaverCount,
    aggregatedDaumCount,
    aggregatedSeenCount,
    aggregatedSubtopics,
    aggregatedEvidence,
    latestLastSeenAt,
    daumEvidenceStrength,
  } = group;
  const isSelected = representative.status === "selected";
  const isDismissed = representative.status === "dismissed";
  const hasMerged = mergedCandidates.length > 0;
  const visibleSubtopics = aggregatedSubtopics.slice(0, MAX_VISIBLE_SUBTOPICS);
  const hiddenSubtopics = aggregatedSubtopics.slice(MAX_VISIBLE_SUBTOPICS);

  return (
    <div className={`rounded-lg border p-4 ${isSelected ? "border-green-300 bg-green-50" : isDismissed ? "border-zinc-200 bg-zinc-50 opacity-60" : "border-zinc-200 bg-white"}`}>
      {/* 헤더: 제목 + 점수만 같은 row에 둔다(부가 정보는 아래 meta line으로
          분리 — 제목 영역이 좁아져 불필요하게 여러 줄로 쪼개지는 문제
          수정). 모바일에서는 세로로 쌓고, sm 이상에서만 가로 배치한다. */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <h3 className="min-w-0 flex-1 break-keep font-semibold leading-snug text-zinc-900">
          {representative.title}
        </h3>
        <div className="shrink-0 text-right sm:w-16">
          <p className="text-lg font-bold text-zinc-800">{representative.score}</p>
          <p className="text-xs text-zinc-500">점수</p>
        </div>
      </div>

      {/* 병합 여부는 아래 배지("유사 후보 N개 병합됨")로 이미 표시하므로
          별도 문구를 헤더 근처에 중복해서 넣지 않는다(카드 단순화). */}

      {representative.description && (
        <p className="mt-2 w-full max-w-none break-keep text-sm leading-relaxed text-zinc-600">
          {representative.description}
        </p>
      )}

      {/* badge: 대표 후보 / 기사 작성 가능 / 유사 후보 병합됨 */}
      <div className="mt-2 flex flex-wrap gap-1">
        <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-xs font-medium text-indigo-700">대표 후보</span>
        {!isSelected && !isDismissed && (
          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700">기사 작성 가능</span>
        )}
        {hasMerged && (
          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">
            유사 후보 {mergedCandidates.length}개 병합됨
          </span>
        )}
        {/* daum 근거가 적어도 테마 자체를 숨기지 않는다 — 대신 근거 강도만 표시한다. */}
        {daumEvidenceStrength === "none" && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
            네이버 중심 테마 (다음 근거 없음)
          </span>
        )}
        {daumEvidenceStrength === "weak" && (
          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-600">
            다음 근거 약함
          </span>
        )}
      </div>

      {/* 네이버/다음 근거 수 · 반복 발견 수 · 마지막 발견 시간 — 기본 표시
          정보(카드 단순화 원칙에 따라 상태 pill 등 중복 정보는 넣지 않는다). */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
        <span>네이버 {aggregatedNaverCount}건</span>
        <span>다음 {aggregatedDaumCount}건</span>
        <span>반복 발견 {aggregatedSeenCount}회</span>
        <span>마지막 발견: {new Date(latestLastSeenAt).toLocaleString("ko-KR")}</span>
      </div>

      {/* 태그/하위 주제 — 기본 화면에서는 숨기고, 열어야 확인할 수 있다(카드 단순화).
          하위 주제는 그 안에서도 기본 3개까지만 보이고 나머지는 "더 보기"로 접는다. */}
      {(representative.keywords.length > 0 || aggregatedSubtopics.length > 0) && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer select-none text-blue-600 hover:text-blue-800">
            하위 주제 보기{aggregatedSubtopics.length > 0 ? ` (${aggregatedSubtopics.length}개)` : ""}
          </summary>
          <div className="mt-1.5 space-y-2">
            {representative.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {representative.keywords.map((kw) => (
                  <span key={kw} className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">{kw}</span>
                ))}
              </div>
            )}
            {aggregatedSubtopics.length > 0 && (
              <div>
                <ul className="flex flex-wrap gap-1">
                  {visibleSubtopics.map((sub) => (
                    <li key={sub} className="break-keep rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-xs text-zinc-600">
                      {sub}
                    </li>
                  ))}
                </ul>
                {hiddenSubtopics.length > 0 && (
                  <details className="mt-1">
                    <summary className="cursor-pointer select-none text-xs text-blue-600 hover:text-blue-800">
                      더 보기 (+{hiddenSubtopics.length})
                    </summary>
                    <ul className="mt-1 flex flex-wrap gap-1">
                      {hiddenSubtopics.map((sub) => (
                        <li key={sub} className="break-keep rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-xs text-zinc-600">
                          {sub}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </div>
        </details>
      )}

      {/* 병합된 후보 — 기본 접힘, 열어야 개별 후보 상세를 볼 수 있다. 여기에는 기사 작성 버튼을 두지 않는다(secondary link 스타일). */}
      {hasMerged && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer select-none text-blue-600 hover:text-blue-800">
            병합된 후보 보기 ({mergedCandidates.length}개)
          </summary>
          <ul className="mt-2 space-y-2">
            {mergedCandidates.map((candidate) => (
              <MergedCandidateRow key={candidate.id} candidate={candidate} />
            ))}
          </ul>
        </details>
      )}

      {/* 원본 근거 — 기본은 숨기고, 열어야 네이버/다음 원본 기사(raw evidence)를 볼 수 있다.
          대표 후보뿐 아니라 병합된 후보의 evidence도 함께(중복 제거해) 보여준다.
          "왜 이 테마가 생성되었는지"는 이 안에서 확인한다(secondary link 스타일). */}
      {aggregatedEvidence.length > 0 && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer select-none text-blue-600 hover:text-blue-800">
            근거 보기 ({aggregatedEvidence.length}건)
          </summary>
          <ul className="mt-1 space-y-1 border-l-2 border-zinc-200 pl-2 text-zinc-500">
            {aggregatedEvidence.map((item, index) => (
              <li key={`${item.platform}-${index}`} className="truncate">
                <PlatformBadge platform={item.platform} /> {item.title}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* 기사 작성 시작은 대표 후보에서만 가능하다 — 병합된 후보에는 이 버튼을 두지 않는다. */}
      {!isSelected && !isDismissed && (
        <form
          action={async () => {
            "use server";
            const result = await selectClusterAsTheme(representative.id);
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

/** "2026.9.5 18:49" 형식으로 마지막 수집 시각을 표시한다. */
function formatCollectedAt(iso: string | null): string {
  if (!iso) return "없음";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
  const { candidates, clusters, counts, lastCollectedAt } = await getTrendPageData();
  // 목록에는 대표 후보만 표시한다 — 유사/중복 후보는 대표 후보 카드 안의
  // "병합된 후보 보기" 접기 영역에서만 확인할 수 있다(lib/trends/theme-cluster-display.ts).
  const displayGroups = groupThemeClustersForDisplay(clusters);

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

        {/* 수집 결과 요약 — 이 화면의 핵심 작업(공통 테마 후보 선택 → 기사
            작성 시작)에 집중할 수 있도록, 상세 상태는 아래 배너로 넘기고
            여기서는 한 줄 요약만 보여준다. */}
        <p className="mb-4 text-sm text-zinc-600">
          수집 결과: 네이버 {counts.naver}건 · 다음 {counts.daum}건 · 공통 테마 {displayGroups.length}건 · 마지막
          수집 {formatCollectedAt(lastCollectedAt)}
        </p>

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

        {/* 이 화면의 핵심 작업은 "공통 테마 후보 선택 후 기사 작성 시작"이다
            — 공통 테마 후보를 먼저(DOM 순서상 위/왼쪽) 두고 더 넓은 폭을
            준다. 원자료(수집된 트렌드 후보)는 근거 확인용 보조 정보라
            나중에, 더 좁게 배치한다. 모바일(좁은 화면)에서는 flex-col이라
            DOM 순서 그대로 공통 테마 후보가 먼저 보인다. */}
        <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[3fr_2fr]">
          {/* 공통 테마 후보 — 대표 후보만 표시(유사 후보는 카드 안 접기 영역) */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-zinc-800">
              공통 테마 후보{" "}
              <span className="font-normal text-zinc-500">({displayGroups.length}건, 점수 높은 순)</span>
            </h2>
            {displayGroups.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-300 py-8 text-center text-sm text-zinc-500">
                추출된 공통 테마가 없습니다. 트렌드를 먼저 수집하세요.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {displayGroups.map((group) => (
                  <ClusterCard key={group.representative.id} group={group} />
                ))}
              </div>
            )}
          </section>

          {/* 수집된 트렌드 후보(원자료) — 근거 확인용 보조 정보라 기본
              접힘 상태로 둔다. 열면 compact list(배지+제목+순위, 요약은
              details 안)로 확인할 수 있다. raw 데이터는 삭제하지 않고
              그대로 보여준다 — 표시만 compact하게 할 뿐이다. */}
          <section>
            <details>
              <summary className="mb-3 cursor-pointer select-none text-base font-semibold text-zinc-800 hover:text-zinc-600">
                수집된 트렌드 후보{" "}
                <span className="font-normal text-zinc-500">({candidates.length}건, 근거 확인용)</span>
              </summary>
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
            </details>
          </section>
        </div>
      </div>
    </div>
  );
}
