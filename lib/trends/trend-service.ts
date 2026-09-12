// Phase 1-12/13: 트렌드 수집 → 클러스터링 → 테마 생성 서비스.
// TREND_COLLECTION_ENABLED=false이면 mock 데이터를 사용한다.
// TREND_COLLECTION_ENABLED=true이면 네이버/다음 실제 API를 사용한다.

import { getMockTrendItems, rawItemToCandidate } from "./mock-trend-provider";
import { searchNaverNews } from "./naver-client";
import { searchDaumNewsMultiPage } from "./daum-client";
import { SEED_QUERIES } from "./seed-queries";
import { expandDaumQueries } from "./daum-query-expansion";
import { getDaumSearchPageSize, getDaumSearchMaxPages } from "./daum-collection-config";
import { filterUsableDaumResults } from "./daum-result-filter";
import { clusterTrendItems } from "./theme-clusterer";
import {
  insertTrendCandidates,
  upsertThemeClusters,
  getThemeClusterById,
  updateThemeClusterStatus,
  getRecentTrendCandidates,
  getThemeClusters,
  getTrendCandidateCounts,
  type InsertTrendCandidateInput,
  type UpsertThemeClusterInput,
  type TrendCandidateCounts,
} from "@/lib/repositories/trend-repository";
import { createTheme, getThemes, updateThemeMetadata } from "@/lib/repositories/theme-repository";
import { addSource, getSourcesByThemeId, DuplicateSourceError } from "@/lib/repositories/source-repository";
import { getArticleByThemeId } from "@/lib/repositories/article-repository";
import { listSocialPostsByArticle } from "@/lib/repositories/social-posts-repository";
import { logEvent } from "@/lib/repositories/log-repository";
import type { TrendCandidate, ThemeCluster, Theme } from "@/lib/types/domain";
import type { TrendSearchResult } from "./types";
import {
  classifyThemeCandidate,
  type ExistingThemeContext,
  type ThemeCandidateClassificationResult,
} from "./theme-candidate-classifier";

export function isTrendEnabled(): boolean {
  return process.env.TREND_COLLECTION_ENABLED === "true";
}

/** 네이버 API key 설정 여부를 반환한다 (값 자체는 노출하지 않는다). */
export function isNaverKeySet(): boolean {
  return !!(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET);
}

/** 카카오 API key 설정 여부를 반환한다 (값 자체는 노출하지 않는다). */
export function isDaumKeySet(): boolean {
  return !!process.env.KAKAO_REST_API_KEY;
}

/** 플랫폼별 수집 결과 (상태 + 건수 + 오류 메시지). */
interface PlatformCollectionResult {
  inputs: InsertTrendCandidateInput[];
  status: "success" | "failed" | "skipped";
  count: number;
  error?: string;
}

/** collectTrendCandidates 반환 타입: 후보 목록 + 플랫폼별 상태. */
export interface TrendCollectionResult {
  candidates: TrendCandidate[];
  naverStatus: "success" | "failed" | "skipped";
  daumStatus: "success" | "failed" | "skipped";
  naverCount: number;
  daumCount: number;
  naverError?: string;
  daumError?: string;
}

function searchResultToInput(item: TrendSearchResult, now: string): InsertTrendCandidateInput {
  return {
    platform: item.platform,
    keyword: item.keyword,
    title: item.title,
    snippet: item.snippet,
    url: item.url,
    rankPosition: item.rankPosition,
    collectedAt: now,
    metadata: { publishedAt: item.publishedAt },
  };
}

/** URL 기준으로 중복을 제거한다. */
function deduplicateByUrl(inputs: InsertTrendCandidateInput[]): InsertTrendCandidateInput[] {
  const seen = new Set<string>();
  return inputs.filter((i) => {
    if (!i.url) return true;
    if (seen.has(i.url)) return false;
    seen.add(i.url);
    return true;
  });
}

/**
 * 네이버 뉴스 API로 seed queries를 검색해 결과를 수집한다.
 * key가 없거나 일부 query가 실패해도 성공한 결과는 반환한다.
 */
async function collectFromNaver(now: string): Promise<PlatformCollectionResult> {
  await logEvent({
    type: "naver_trend_collection_started",
    status: "info",
    message: "네이버 뉴스 수집 시작",
    details: { queryCount: SEED_QUERIES.length },
  });

  if (!isNaverKeySet()) {
    const msg = "NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET이 설정되지 않았습니다.";
    await logEvent({
      type: "naver_trend_collection_failed",
      status: "failed",
      message: msg,
    });
    return { inputs: [], status: "skipped", count: 0, error: msg };
  }

  const results = await Promise.allSettled(
    SEED_QUERIES.map((q) => searchNaverNews(q, 5))
  );

  const inputs: InsertTrendCandidateInput[] = [];
  let failCount = 0;
  const errors: string[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      inputs.push(...result.value.map((item) => searchResultToInput(item, now)));
    } else {
      failCount++;
      errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
    }
  }

  const status = inputs.length > 0 ? "success" : "failed";

  await logEvent({
    type: status === "success" ? "naver_trend_collection_completed" : "naver_trend_collection_failed",
    status,
    message: `네이버 수집 완료: ${inputs.length}건 (실패 query ${failCount}건)`,
    details: { count: inputs.length, failCount },
  });

  return { inputs, status, count: inputs.length, error: errors[0] };
}

/**
 * 카카오 Daum 웹 검색 API로 seed queries를 검색해 결과를 수집한다.
 * key가 없거나 일부 query가 실패해도 성공한 결과는 반환한다.
 *
 * Phase 1-17: naver는 46건, daum은 4건만 보이는 문제를 진단한 결과, 실제
 * 원인은 collectFromDaum() 자체(원본 수집량)가 아니라 화면 조회 단계
 * (getRecentTrendCandidates)의 tie-break 문제였다(자세한 내용은
 * docs/phase-1-17-daum-collection-balance.md 참고). 그래도 수집량/저장률을
 * 더 개선할 수 있는 부분(query expansion, page 반복, 완화된 필터, 상세
 * 진단 로그)은 이 함수에 반영했다.
 */
async function collectFromDaum(now: string): Promise<PlatformCollectionResult> {
  const expandedQueries = expandDaumQueries(SEED_QUERIES);

  await logEvent({
    type: "daum_trend_collection_started",
    status: "info",
    message: `다음(카카오) 뉴스 수집 시작 (seed ${SEED_QUERIES.length}건 → 확장 검색어 ${expandedQueries.length}건)`,
    details: { seedQueryCount: SEED_QUERIES.length, expandedQueryCount: expandedQueries.length },
  });

  if (!isDaumKeySet()) {
    const msg = "KAKAO_REST_API_KEY가 설정되지 않았습니다.";
    await logEvent({
      type: "daum_trend_collection_failed",
      status: "failed",
      message: msg,
    });
    return { inputs: [], status: "skipped", count: 0, error: msg };
  }

  const pageSize = getDaumSearchPageSize();
  const maxPages = getDaumSearchMaxPages();

  const results = await Promise.allSettled(
    expandedQueries.map((q) => searchDaumNewsMultiPage(q, { pageSize, maxPages }))
  );

  const rawResults: TrendSearchResult[] = [];
  let failCount = 0;
  const errors: string[] = [];
  // query별 결과 수 — 원본 응답이 아니라 개수만 남긴다(로그 안전).
  const perQueryCounts: Record<string, number> = {};

  results.forEach((result, index) => {
    const query = expandedQueries[index];
    if (result.status === "fulfilled") {
      perQueryCounts[query] = result.value.length;
      rawResults.push(...result.value);
    } else {
      failCount++;
      perQueryCounts[query] = 0;
      errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
    }
  });

  const rawDocumentsCount = rawResults.length;
  const mappedInputs = rawResults.map((item) => searchResultToInput(item, now));

  // publisher/게시일을 필수로 요구하지 않는다 — url이 없는(활용 불가능한)
  // 항목만 제외한다(lib/trends/daum-result-filter.ts).
  const { kept, filteredOutCount, skippedReasonsSummary } = filterUsableDaumResults(mappedInputs);
  const dedupedInputs = deduplicateByUrl(kept);
  const dedupedOutCount = kept.length - dedupedInputs.length;

  const status = dedupedInputs.length > 0 ? "success" : "failed";

  await logEvent({
    type: status === "success" ? "daum_trend_collection_completed" : "daum_trend_collection_failed",
    status,
    message: `다음 수집 완료: ${dedupedInputs.length}건 (원본 ${rawDocumentsCount}건, 필터 제외 ${filteredOutCount}건, 중복 제외 ${dedupedOutCount}건, 실패 query ${failCount}/${expandedQueries.length}건)`,
    details: {
      rawDocumentsCount,
      mappedDocumentsCount: mappedInputs.length,
      filteredOutCount,
      dedupedOutCount,
      savedCount: dedupedInputs.length,
      skippedReasonsSummary,
      queryCount: expandedQueries.length,
      failCount,
      pageSize,
      maxPages,
      perQueryCounts,
      // API key/raw response 전체는 절대 남기지 않는다 — title/url 샘플 최대 3개까지만.
      sampleResults: dedupedInputs.slice(0, 3).map((i) => ({ title: i.title, url: i.url })),
    },
  });

  return { inputs: dedupedInputs, status, count: dedupedInputs.length, error: errors[0] };
}

/**
 * 트렌드 후보를 수집해 trend_candidates에 저장한다.
 * TREND_COLLECTION_ENABLED=false이면 mock 데이터를 사용한다.
 * 반환값에 플랫폼별 성공/실패 상태가 포함된다.
 */
export async function collectTrendCandidates(): Promise<TrendCollectionResult> {
  await logEvent({
    type: "trend_collection_started",
    status: "info",
    message: isTrendEnabled() ? "실제 API로 트렌드 수집 시작" : "mock 모드로 트렌드 수집 시작",
    details: { mode: isTrendEnabled() ? "api" : "mock" },
  });

  try {
    const now = new Date().toISOString();

    if (!isTrendEnabled()) {
      // mock mode
      const mockItems = getMockTrendItems();
      const inputs = mockItems.map((item) => {
        const candidate = rawItemToCandidate(item, now);
        return {
          platform: candidate.platform,
          keyword: candidate.keyword,
          title: candidate.title,
          snippet: candidate.snippet,
          url: candidate.url,
          rankPosition: candidate.rankPosition,
          collectedAt: now,
          metadata: { source: "mock" },
        };
      });

      const saved = await insertTrendCandidates(inputs);

      await logEvent({
        type: "trend_collection_completed",
        status: "success",
        message: `트렌드 후보 ${saved.length}건 수집 완료 (mock)`,
        details: { count: saved.length, mode: "mock" },
      });

      return {
        candidates: saved,
        naverStatus: "skipped",
        daumStatus: "skipped",
        naverCount: 0,
        daumCount: 0,
      };
    }

    // 네이버 + 다음 병렬 수집 (한쪽 실패해도 나머지 저장)
    const [naverResult, daumResult] = await Promise.all([
      collectFromNaver(now),
      collectFromDaum(now),
    ]);

    const beforeDedupeCount = naverResult.inputs.length + daumResult.inputs.length;
    const allInputs = deduplicateByUrl([...naverResult.inputs, ...daumResult.inputs]);
    const duplicateRemovedCount = beforeDedupeCount - allInputs.length;

    if (allInputs.length === 0) {
      throw new Error(
        "네이버/다음 API 모두 결과를 반환하지 않았습니다. API key 설정을 확인하세요."
      );
    }

    const saved = await insertTrendCandidates(allInputs);
    const naverCount = saved.filter((c) => c.platform === "naver").length;
    const daumCount = saved.filter((c) => c.platform === "daum").length;

    await logEvent({
      type: "trend_collection_completed",
      status: "success",
      message: `트렌드 후보 ${saved.length}건 수집 완료 (네이버 ${naverCount}건, 다음 ${daumCount}건, 최종 결합 단계 중복 제외 ${duplicateRemovedCount}건)`,
      details: { count: saved.length, mode: "api", naverCount, daumCount, duplicateRemovedCount },
    });

    return {
      candidates: saved,
      naverStatus: naverResult.status,
      daumStatus: daumResult.status,
      naverCount,
      daumCount,
      naverError: naverResult.error,
      daumError: daumResult.error,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logEvent({
      type: "trend_collection_failed",
      status: "failed",
      message: `트렌드 수집 실패: ${message}`,
      details: { error: message },
    });
    throw err;
  }
}

/**
 * 최근 수집된 트렌드 후보를 클러스터링해 theme_clusters에 저장한다.
 */
export async function clusterCommonThemes(): Promise<ThemeCluster[]> {
  await logEvent({
    type: "theme_clustering_started",
    status: "info",
    message: "공통 테마 클러스터링 시작",
  });

  const candidates = await getRecentTrendCandidates(200);

  const rawItems = candidates.map((c) => ({
    platform: c.platform as "naver" | "daum" | "mock",
    keyword: c.keyword ?? "",
    title: c.title ?? "",
    snippet: c.snippet ?? "",
    url: c.url ?? "",
    rankPosition: c.rankPosition ?? 0,
  }));

  const clusterCandidates = clusterTrendItems(rawItems);

  if (clusterCandidates.length === 0) {
    await logEvent({
      type: "theme_clustering_completed",
      status: "success",
      message: "공통 테마 없음 (클러스터 미생성)",
      details: { count: 0 },
    });
    return [];
  }

  const inputs: UpsertThemeClusterInput[] = clusterCandidates.map((c) => ({
    title: c.group.title,
    description: c.group.description,
    keywords: c.matchedKeywords.slice(0, 5),
    naverCount: c.naverCount,
    daumCount: c.daumCount,
    score: c.score,
    normalizedKey: c.normalizedThemeKey,
    subtopics: c.subtopics,
    evidence: c.evidence,
  }));

  // 재수집 시 같은 후보가 계속 새로 쌓이지 않도록, insert 대신 기존
  // 후보와 비교해 병합(update)하거나 새로 추가하는 upsertThemeClusters를
  // 사용한다(lib/repositories/trend-repository.ts 참고).
  const saved = await upsertThemeClusters(inputs);

  await logEvent({
    type: "theme_clustering_completed",
    status: "success",
    message: `테마 클러스터 ${saved.length}건 처리 완료(신규+병합)`,
    details: { count: saved.length },
  });

  return saved;
}

/**
 * theme_cluster를 themes 테이블에 저장하고 cluster status를 selected로 변경한다.
 */
export async function createThemeFromCluster(clusterId: string): Promise<Theme> {
  const cluster = await getThemeClusterById(clusterId);
  if (!cluster) {
    throw new Error(`테마 클러스터를 찾을 수 없습니다: ${clusterId}`);
  }

  await logEvent({
    type: "theme_selected",
    status: "info",
    message: `테마 클러스터 선택: ${cluster.title}`,
    details: { clusterId, clusterTitle: cluster.title },
  });

  const theme = await createTheme({
    title: cluster.title,
    description: cluster.description,
    keywords: cluster.keywords,
    language: "ko",
    metadata: {
      creation_method: "trend_cluster",
      theme_cluster_id: clusterId,
    },
  });

  await updateThemeClusterStatus(clusterId, "selected");

  await logEvent({
    type: "theme_created_from_cluster",
    status: "success",
    message: `클러스터에서 테마 생성: ${theme.title}`,
    themeId: theme.id,
    details: { themeId: theme.id, clusterId, clusterTitle: cluster.title },
  });

  return theme;
}

/**
 * 최근 수집된 후보 목록과 클러스터 목록을 함께 반환한다 (/trends 페이지용).
 */
/**
 * Phase 1-20: /trends 상단 "수집 결과" 요약에 쓸, 표시된 candidates
 * 중 가장 최근 collected_at을 찾는다(정확한 전역 최신값은 아닐 수
 * 있지만 — candidates는 표시용으로 균형 조정된 최근 후보 목록이라
 * 실제 최신 수집 시각과 사실상 같다 — 별도 쿼리 없이 표시용 근사치로
 * 충분하다).
 */
function findLatestCollectedAt(candidates: TrendCandidate[]): string | null {
  return candidates.reduce<string | null>((latest, c) => {
    if (!latest) return c.collectedAt;
    return new Date(c.collectedAt).getTime() > new Date(latest).getTime() ? c.collectedAt : latest;
  }, null);
}

/**
 * Phase 1-24: cross-day 중복/업데이트 판단에 쓸 기존 테마 컨텍스트를
 * 모은다 — 보관되지 않은(활성) 테마마다 등록된 출처 URL, 마스터
 * 원고/플랫폼 글 존재 여부, 최근 갱신 시각을 함께 담는다. DB schema는
 * 바꾸지 않고 기존 조회 함수만 조합한다.
 */
export async function getExistingThemeContextsForCrossDayCheck(): Promise<ExistingThemeContext[]> {
  const themes = await getThemes();

  return Promise.all(
    themes.map(async (theme): Promise<ExistingThemeContext> => {
      const sources = await getSourcesByThemeId(theme.id);
      const article = await getArticleByThemeId(theme.id);
      const socialPosts = article ? await listSocialPostsByArticle(article.id) : [];

      const lastSourceAt = sources.reduce<string | null>((latest, s) => {
        if (!latest) return s.createdAt;
        return new Date(s.createdAt).getTime() > new Date(latest).getTime() ? s.createdAt : latest;
      }, null);

      return {
        theme,
        sourceUrls: sources.map((s) => s.url),
        sourceCount: sources.length,
        hasMasterManuscript: Boolean(article),
        hasSocialPosts: socialPosts.length > 0,
        lastUpdatedAt: lastSourceAt ?? theme.createdAt,
      };
    })
  );
}

/**
 * 공통 테마 후보 목록을 기존 테마와 비교해 분류 결과 맵(clusterId →
 * 분류 결과)을 만든다. 화면(/trends)에서 대표 후보마다 배지/버튼을
 * 결정하는 데 사용한다.
 */
export async function classifyThemeClustersAgainstExistingThemes(
  clusters: ThemeCluster[]
): Promise<Map<string, ThemeCandidateClassificationResult>> {
  await logEvent({
    type: "theme_candidate_cross_day_check_started",
    status: "info",
    message: `cross-day 중복 검사 시작 (후보 ${clusters.length}건)`,
    details: { candidateCount: clusters.length },
  });

  const existingContexts = await getExistingThemeContextsForCrossDayCheck();
  const result = new Map<string, ThemeCandidateClassificationResult>();
  const summary = { new_theme: 0, existing_theme_update: 0, duplicate_theme: 0, needs_review: 0 };

  for (const cluster of clusters) {
    const classification = classifyThemeCandidate(cluster, existingContexts);
    result.set(cluster.id, classification);
    summary[classification.classification]++;

    const eventTypeByClassification = {
      new_theme: "theme_candidate_classified_new",
      existing_theme_update: "theme_candidate_classified_existing_update",
      duplicate_theme: "theme_candidate_classified_duplicate",
      needs_review: "theme_candidate_classified_needs_review",
    } as const;

    await logEvent({
      type: eventTypeByClassification[classification.classification],
      status: "info",
      message: `테마 후보 "${cluster.title}" → ${classification.classification}`,
      details: {
        candidateId: cluster.id,
        normalizedThemeKey: cluster.normalizedKey,
        existingThemeId: classification.matchedExistingTheme?.id ?? null,
        classification: classification.classification,
        newUrlCount: classification.newUrlCount,
        duplicateUrlCount: classification.duplicateUrlCount,
        similarityScore: classification.similarityScore,
      },
    });
  }

  await logEvent({
    type: "theme_candidate_cross_day_check_completed",
    status: "success",
    message: `cross-day 중복 검사 완료 (신규 ${summary.new_theme} · 기존 업데이트 ${summary.existing_theme_update} · 중복 ${summary.duplicate_theme} · 확인 필요 ${summary.needs_review})`,
    details: { ...summary, candidateCount: clusters.length },
  });

  return result;
}

/** "기존 테마 보기/자료 추가" 클릭 시 이유 없이 막히지 않았음을 남기는 로그. */
export async function logThemeCandidateSelectionOutcome(input: {
  clusterId: string;
  outcome: "duplicate_redirected_to_existing" | "merged_redirected_to_canonical" | "split_as_new_theme";
  existingThemeId?: string;
  canonicalClusterId?: string;
}): Promise<void> {
  const eventTypeMap = {
    duplicate_redirected_to_existing: "theme_candidate_duplicate_redirected_to_existing",
    merged_redirected_to_canonical: "theme_candidate_merged_redirected_to_canonical",
    split_as_new_theme: "theme_candidate_split_as_new_theme",
  } as const;

  await logEvent({
    type: eventTypeMap[input.outcome],
    status: "info",
    message: `후보 선택 결과: ${input.outcome}`,
    details: {
      candidateId: input.clusterId,
      existingThemeId: input.existingThemeId ?? null,
      canonicalClusterId: input.canonicalClusterId ?? null,
    },
  });
}

export interface AddClusterToExistingThemeResult {
  themeId: string;
  themeTitle: string;
  addedCount: number;
  skippedDuplicateCount: number;
  failedCount: number;
}

/**
 * existing_theme_update로 분류된 공통 테마 후보의 근거 URL을 기존 테마의
 * 출처(sources)로 등록한다. 이미 등록된 URL은 sources 테이블의
 * (theme_id, url) unique 제약(DuplicateSourceError)으로 자동 제외된다.
 * 기존 마스터 원고/플랫폼 글은 절대 자동으로 덮어쓰지 않는다 — 대신
 * theme.metadata에 "갱신 권장" 플래그만 남긴다(사용자가 직접 갱신 여부를
 * 선택하도록 /dashboard에서 안내).
 */
export async function addClusterEvidenceToExistingTheme(
  clusterId: string,
  existingThemeId: string
): Promise<AddClusterToExistingThemeResult> {
  const cluster = await getThemeClusterById(clusterId);
  if (!cluster) {
    throw new Error(`테마 클러스터를 찾을 수 없습니다: ${clusterId}`);
  }

  const existingSources = await getSourcesByThemeId(existingThemeId);
  const existingUrls = new Set(existingSources.map((s) => s.url));

  const uniqueEvidence = cluster.evidence.filter((item, index, all) => {
    if (!item.url) return false;
    return all.findIndex((other) => other.url === item.url) === index;
  });

  let addedCount = 0;
  let skippedDuplicateCount = 0;
  let failedCount = 0;

  for (const item of uniqueEvidence) {
    if (!item.url) continue;
    if (existingUrls.has(item.url)) {
      skippedDuplicateCount++;
      continue;
    }
    try {
      await addSource({
        themeId: existingThemeId,
        url: item.url,
        title: item.title,
        publisher: item.platform,
        publishedAt: "",
        summary: "",
        metadata: { collection_method: "theme_candidate_cross_day_update", source_cluster_id: clusterId },
      });
      addedCount++;
    } catch (err) {
      if (err instanceof DuplicateSourceError) {
        skippedDuplicateCount++;
      } else {
        failedCount++;
      }
    }
  }

  const theme = (await getExistingThemeContextsForCrossDayCheck()).find((c) => c.theme.id === existingThemeId)?.theme;
  const themeTitle = theme?.title ?? existingThemeId;

  if (addedCount > 0) {
    // 자동으로 마스터 원고/플랫폼 글을 재생성하지 않는다 — "갱신 권장"
    // 플래그만 남기고, 실제 갱신 여부는 /dashboard에서 사용자가 선택한다.
    await updateThemeMetadata(existingThemeId, {
      needsMasterManuscriptRefresh: true,
      lastCrossDayUpdateAt: new Date().toISOString(),
      lastCrossDayAddedSourceCount: addedCount,
      lastCrossDaySourceClusterId: clusterId,
    });
  }

  await logEvent({
    type: "theme_candidate_existing_theme_updated",
    status: "success",
    message: `기존 테마 "${themeTitle}"에 후보 "${cluster.title}"의 출처 ${addedCount}건 추가 (중복 제외 ${skippedDuplicateCount}건, 실패 ${failedCount}건)`,
    themeId: existingThemeId,
    details: { clusterId, existingThemeId, addedCount, skippedDuplicateCount, failedCount },
  });

  return { themeId: existingThemeId, themeTitle, addedCount, skippedDuplicateCount, failedCount };
}

/** duplicate_theme 후보를 "다시 표시하지 않기" 처리한다(soft: status를 dismissed로 변경, 삭제하지 않음). */
export async function dismissThemeClusterCandidate(clusterId: string): Promise<void> {
  await updateThemeClusterStatus(clusterId, "dismissed");
  await logEvent({
    type: "theme_candidate_selection_blocked_with_reason",
    status: "info",
    message: `중복 후보 "다시 표시하지 않기" 처리: ${clusterId}`,
    details: { clusterId, reason: "duplicate_theme_dismissed_by_user" },
  });
}

/**
 * 최근 수집된 후보 목록과 클러스터 목록, 상단 요약 배너에 쓸 전체
 * 개수/마지막 수집 시각을 함께 반환한다 (/trends 페이지용).
 */
export async function getTrendPageData(): Promise<{
  candidates: TrendCandidate[];
  clusters: ThemeCluster[];
  counts: TrendCandidateCounts;
  lastCollectedAt: string | null;
}> {
  const [candidates, clusters, counts] = await Promise.all([
    getRecentTrendCandidates(50),
    getThemeClusters(),
    getTrendCandidateCounts(),
  ]);
  return { candidates, clusters, counts, lastCollectedAt: findLatestCollectedAt(candidates) };
}
