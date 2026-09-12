// Phase 1-12/13: 자동 공통 테마 추출 페이지.
// 트렌드 후보 수집 → 클러스터링 → 사용자 선택 → themes 저장 흐름을 담당한다.

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getTrendPageData,
  isTrendEnabled,
  isNaverKeySet,
  isDaumKeySet,
  classifyThemeClustersAgainstExistingThemes,
} from "@/lib/trends/trend-service";
import { groupThemeClustersForDisplay, type DisplayThemeCluster } from "@/lib/trends/theme-cluster-display";
import {
  THEME_CANDIDATE_CLASSIFICATION_LABEL,
  type ThemeCandidateClassification,
  type ThemeCandidateClassificationResult,
} from "@/lib/trends/theme-candidate-classifier";
import {
  runTrendCollection,
  selectClusterAsTheme,
  selectCanonicalClusterForMergedCandidate,
  splitClusterAsNewTheme,
  dismissClusterCandidate,
  addClusterToExistingTheme,
} from "./actions";
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

/** Phase 1-24: raw enum(new_theme 등)을 그대로 노출하지 않고 배지 색상 + 한국어 라벨만 표시한다. */
const CLASSIFICATION_BADGE_CLASSES: Record<ThemeCandidateClassification, string> = {
  new_theme: "bg-emerald-100 text-emerald-700",
  existing_theme_update: "bg-blue-100 text-blue-700",
  duplicate_theme: "bg-zinc-200 text-zinc-600",
  needs_review: "bg-amber-100 text-amber-700",
};

function ClassificationBadge({ classification }: { classification: ThemeCandidateClassification }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${CLASSIFICATION_BADGE_CLASSES[classification]}`}>
      {THEME_CANDIDATE_CLASSIFICATION_LABEL[classification]}
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

/**
 * 병합된 후보 하나의 요약 정보. "이 테마로 기사 작성 시작" 버튼은 표시하지
 * 않지만 — Phase 1-24: 클릭했을 때 아무 반응 없이 막히는 문제(항목 8)를
 * 고치기 위해 "왜 직접 선택할 수 없는지" 설명 + 대표 테마로 연결하는
 * 버튼을 반드시 함께 보여준다. 대표 후보가 이미 기존 테마와 매칭됐다면
 * "기존 테마 보기" 링크도 함께 제공한다.
 */
function MergedCandidateRow({
  candidate,
  representativeId,
  representativeTitle,
  representativeSelectable,
  matchedExistingThemeId,
}: {
  candidate: ThemeCluster;
  representativeId: string;
  representativeTitle: string;
  representativeSelectable: boolean;
  matchedExistingThemeId: string | null;
}) {
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
      <p className="mt-2 break-keep text-xs text-zinc-500">
        이 후보는 대표 테마 &ldquo;{representativeTitle}&rdquo;에 병합되었습니다. 같은 이슈로 판단되어 이
        후보만 따로 선택할 수는 없습니다 — 대신 대표 테마를 선택하거나 이미 있는 기존 테마를 확인하세요.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {representativeSelectable && (
          <form
            action={async () => {
              "use server";
              const result = await selectCanonicalClusterForMergedCandidate(candidate.id, representativeId);
              if (result.success && result.data) {
                const { themeId } = result.data as { themeId: string };
                redirect(`/dashboard?themeId=${themeId}`);
              }
            }}
          >
            <button
              type="submit"
              className="rounded border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
            >
              대표 테마 선택
            </button>
          </form>
        )}
        {matchedExistingThemeId && (
          <Link
            href={`/dashboard?themeId=${matchedExistingThemeId}`}
            className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
          >
            기존 테마 보기
          </Link>
        )}
      </div>
    </li>
  );
}

function ClusterCard({
  group,
  classification,
}: {
  group: DisplayThemeCluster;
  classification: ThemeCandidateClassificationResult;
}) {
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
  const matchedThemeId = classification.matchedExistingTheme?.id ?? null;
  const matchedThemeTitle = classification.matchedExistingTheme?.title ?? null;
  const matchedThemeContext = classification.matchedExistingThemeContext;

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

      {/* badge: 상태 분류 / 대표 후보 / 기사 작성 가능 / 유사 후보 병합됨 */}
      <div className="mt-2 flex flex-wrap gap-1">
        <ClassificationBadge classification={classification.classification} />
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
              <MergedCandidateRow
                key={candidate.id}
                candidate={candidate}
                representativeId={representative.id}
                representativeTitle={representative.title}
                representativeSelectable={!isSelected && !isDismissed}
                matchedExistingThemeId={matchedThemeId}
              />
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

      {/* Phase 1-24: 상태 분류에 따라 primary action을 하나만 강조한다.
          - new_theme: 기존과 같은 "이 테마로 기사 작성 시작"(=새 테마로 만들기).
          - existing_theme_update/needs_review/duplicate_theme: 각각 전용
            안내 카드 + 버튼을 보여준다. "선택 불가"로 끝내지 않고 항상
            다음 행동(기존 테마 보기/자료 추가/새 테마로 분리)을 제공한다. */}
      {!isSelected && !isDismissed && classification.classification === "new_theme" && (
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

      {!isSelected && !isDismissed && classification.classification === "existing_theme_update" && matchedThemeId && (
        <div className="mt-3 rounded border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
          <p className="font-medium">기존 테마 업데이트</p>
          <p className="mt-1 break-keep">{classification.reason}</p>
          <p className="mt-1 break-keep text-blue-700">
            기존 테마: {matchedThemeTitle} · 출처 {matchedThemeContext?.sourceCount ?? 0}개
            {matchedThemeContext?.hasMasterManuscript ? " · 원고 생성 완료" : ""}
          </p>
          <p className="mt-1 break-keep text-blue-700">
            오늘 새 자료: 새 URL {classification.newUrlCount}개 · 중복 {classification.duplicateUrlCount}개 제외
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <form
              action={async () => {
                "use server";
                await addClusterToExistingTheme(representative.id, matchedThemeId);
              }}
            >
              <button
                type="submit"
                className="rounded border border-blue-400 bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-500"
              >
                기존 테마에 추가
              </button>
            </form>
            <Link
              href={`/dashboard?themeId=${matchedThemeId}`}
              className="rounded border border-blue-300 bg-white px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
            >
              기존 테마 보기
            </Link>
            <form
              action={async () => {
                "use server";
                const result = await splitClusterAsNewTheme(representative.id);
                if (result.success && result.data) {
                  const { themeId } = result.data as { themeId: string };
                  redirect(`/dashboard?themeId=${themeId}`);
                }
              }}
            >
              <button
                type="submit"
                className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
              >
                새 하위 주제로 분리
              </button>
            </form>
          </div>
        </div>
      )}

      {!isSelected && !isDismissed && classification.classification === "duplicate_theme" && matchedThemeId && (
        <div className="mt-3 rounded border border-zinc-300 bg-zinc-50 p-3 text-xs text-zinc-700">
          <p className="font-medium">중복 테마</p>
          <p className="mt-1 break-keep">{classification.reason}</p>
          <p className="mt-1 break-keep text-zinc-500">
            기존 테마: {matchedThemeTitle} · 출처 {matchedThemeContext?.sourceCount ?? 0}개 · 최근 업데이트{" "}
            {matchedThemeContext ? new Date(matchedThemeContext.lastUpdatedAt).toLocaleDateString("ko-KR") : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              href={`/dashboard?themeId=${matchedThemeId}`}
              className="rounded border border-zinc-400 bg-white px-2.5 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-100"
            >
              기존 테마 보기
            </Link>
            <form
              action={async () => {
                "use server";
                await dismissClusterCandidate(representative.id);
              }}
            >
              <button
                type="submit"
                className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
              >
                다시 표시하지 않기
              </button>
            </form>
          </div>
        </div>
      )}

      {!isSelected && !isDismissed && classification.classification === "needs_review" && matchedThemeId && (
        <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <p className="font-medium">확인 필요</p>
          <p className="mt-1 break-keep">{classification.reason}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div className="rounded border border-amber-200 bg-white p-2">
              <p className="font-medium text-amber-800">기존 테마</p>
              <p className="mt-0.5 break-keep">{matchedThemeTitle}</p>
              {classification.matchedExistingTheme?.description && (
                <p className="mt-0.5 break-keep text-amber-700">{classification.matchedExistingTheme.description}</p>
              )}
            </div>
            <div className="rounded border border-amber-200 bg-white p-2">
              <p className="font-medium text-amber-800">오늘 후보</p>
              <p className="mt-0.5 break-keep">{representative.title}</p>
              {representative.description && (
                <p className="mt-0.5 break-keep text-amber-700">{representative.description}</p>
              )}
            </div>
          </div>
          {(classification.commonKeywords.length > 0 ||
            classification.onlyExistingKeywords.length > 0 ||
            classification.onlyCandidateKeywords.length > 0) && (
            <div className="mt-2 space-y-1">
              {classification.commonKeywords.length > 0 && (
                <p className="break-keep">공통 키워드: {classification.commonKeywords.join(", ")}</p>
              )}
              {classification.onlyExistingKeywords.length > 0 && (
                <p className="break-keep">기존 테마만: {classification.onlyExistingKeywords.join(", ")}</p>
              )}
              {classification.onlyCandidateKeywords.length > 0 && (
                <p className="break-keep">오늘 후보만: {classification.onlyCandidateKeywords.join(", ")}</p>
              )}
            </div>
          )}
          <p className="mt-1 break-keep">
            새 URL {classification.newUrlCount}개 · 중복 URL {classification.duplicateUrlCount}개
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <form
              action={async () => {
                "use server";
                await addClusterToExistingTheme(representative.id, matchedThemeId);
              }}
            >
              <button
                type="submit"
                className="rounded border border-amber-400 bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-200"
              >
                기존 테마에 추가
              </button>
            </form>
            <form
              action={async () => {
                "use server";
                const result = await splitClusterAsNewTheme(representative.id);
                if (result.success && result.data) {
                  const { themeId } = result.data as { themeId: string };
                  redirect(`/dashboard?themeId=${themeId}`);
                }
              }}
            >
              <button
                type="submit"
                className="rounded border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-50"
              >
                새 테마로 만들기
              </button>
            </form>
            <Link
              href={`/dashboard?themeId=${matchedThemeId}`}
              className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
            >
              기존 테마 보기
            </Link>
          </div>
        </div>
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
    filter?: string;
    updateThemeId?: string;
    updateThemeTitle?: string;
    updateAdded?: string;
    updateSkipped?: string;
    updateFailed?: string;
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
    filter: rawFilter,
    updateThemeId,
    updateThemeTitle,
    updateAdded,
    updateSkipped,
    updateFailed,
  } = await searchParams;
  const { candidates, clusters, counts, lastCollectedAt } = await getTrendPageData();
  // 목록에는 대표 후보만 표시한다 — 유사/중복 후보는 대표 후보 카드 안의
  // "병합된 후보 보기" 접기 영역에서만 확인할 수 있다(lib/trends/theme-cluster-display.ts).
  const displayGroups = groupThemeClustersForDisplay(clusters);

  // Phase 1-24: 오늘 병합된 대표 후보를 기존 테마와 비교해
  // new_theme/existing_theme_update/duplicate_theme/needs_review로
  // 분류한다(cross-day duplicate check). DB는 수정하지 않고 화면
  // 표시/필터/버튼 결정에만 사용한다.
  const classificationMap = await classifyThemeClustersAgainstExistingThemes(
    displayGroups.map((group) => group.representative)
  );
  const classificationCounts = {
    new_theme: 0,
    existing_theme_update: 0,
    duplicate_theme: 0,
    needs_review: 0,
  };
  for (const group of displayGroups) {
    const classification = classificationMap.get(group.representative.id)?.classification;
    if (classification) classificationCounts[classification]++;
  }

  const validFilters: ThemeCandidateClassification[] = [
    "new_theme",
    "existing_theme_update",
    "duplicate_theme",
    "needs_review",
  ];
  const activeFilter: ThemeCandidateClassification | "all" = validFilters.includes(
    rawFilter as ThemeCandidateClassification
  )
    ? (rawFilter as ThemeCandidateClassification)
    : "all";
  const filteredDisplayGroups =
    activeFilter === "all"
      ? displayGroups
      : displayGroups.filter((group) => classificationMap.get(group.representative.id)?.classification === activeFilter);

  const updateResultAddedCount = updateAdded ? Number(updateAdded) : null;
  const updateResultSkippedCount = updateSkipped ? Number(updateSkipped) : null;
  const updateResultFailedCount = updateFailed ? Number(updateFailed) : null;

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

        {/* Phase 1-24: "기존 테마에 추가" 실행 결과 — 추가한 뒤에도 사용자가
            멈추지 않도록 결과 요약 + 다음 작업(기존 테마 보기/마스터 원고
            갱신 확인/대시보드로 이동)을 항상 함께 보여준다. */}
        {updateThemeId && updateResultAddedCount !== null && (
          <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <p className="font-medium">기존 테마 업데이트 완료</p>
            <p className="mt-1 break-keep">
              &ldquo;{updateThemeTitle ?? updateThemeId}&rdquo; 테마에 새 출처 {updateResultAddedCount}개를
              추가했습니다. 중복 URL {updateResultSkippedCount ?? 0}개는 제외했습니다.
              {updateResultFailedCount ? ` (실패 ${updateResultFailedCount}건)` : ""}
            </p>
            <p className="mt-1 break-keep text-xs text-blue-700">
              새 출처가 추가되었습니다. 기존 마스터 원고에 새 자료를 반영할지 확인하세요. 자동으로 원고나 플랫폼
              글을 다시 만들지는 않습니다 — 아래에서 직접 선택하세요.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link
                href={`/dashboard?themeId=${updateThemeId}#generate-draft`}
                className="rounded border border-blue-400 bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-500"
              >
                마스터 원고 갱신 확인
              </Link>
              <Link
                href={`/dashboard?themeId=${updateThemeId}`}
                className="rounded border border-blue-300 bg-white px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
              >
                기존 테마 보기
              </Link>
              <Link
                href="/dashboard"
                className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
              >
                대시보드로 이동
              </Link>
            </div>
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

            {/* Phase 1-24: 자동테마 분석 결과 요약 + 상태별 필터. raw enum을
                노출하지 않고 한국어 라벨/개수만 보여준다. */}
            {displayGroups.length > 0 && (
              <div className="mb-3 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-600">
                <p className="font-medium text-zinc-700">
                  신규 테마 {classificationCounts.new_theme}개 · 기존 테마 업데이트{" "}
                  {classificationCounts.existing_theme_update}개 · 중복 테마 {classificationCounts.duplicate_theme}개
                  · 확인 필요 {classificationCounts.needs_review}개
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(
                    [
                      { value: "all", label: `전체 (${displayGroups.length})` },
                      { value: "new_theme", label: `신규 (${classificationCounts.new_theme})` },
                      { value: "existing_theme_update", label: `기존 업데이트 (${classificationCounts.existing_theme_update})` },
                      { value: "duplicate_theme", label: `중복 (${classificationCounts.duplicate_theme})` },
                      { value: "needs_review", label: `확인 필요 (${classificationCounts.needs_review})` },
                    ] as const
                  ).map((option) => (
                    <Link
                      key={option.value}
                      href={option.value === "all" ? "/trends" : `/trends?filter=${option.value}`}
                      className={`rounded px-2 py-1 text-xs font-medium ${
                        activeFilter === option.value
                          ? "bg-zinc-900 text-white"
                          : "border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-100"
                      }`}
                    >
                      {option.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {displayGroups.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-300 py-8 text-center text-sm text-zinc-500">
                추출된 공통 테마가 없습니다. 트렌드를 먼저 수집하세요.
              </p>
            ) : filteredDisplayGroups.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-300 py-8 text-center text-sm text-zinc-500">
                이 상태에 해당하는 공통 테마 후보가 없습니다.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredDisplayGroups.map((group) => (
                  <ClusterCard
                    key={group.representative.id}
                    group={group}
                    classification={
                      classificationMap.get(group.representative.id) ?? {
                        classification: "new_theme",
                        matchedExistingTheme: null,
                        matchedExistingThemeContext: null,
                        newUrls: [],
                        newUrlCount: 0,
                        duplicateUrlCount: 0,
                        similarityScore: null,
                        reason: "",
                        commonKeywords: [],
                        onlyExistingKeywords: [],
                        onlyCandidateKeywords: [],
                      }
                    }
                  />
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
