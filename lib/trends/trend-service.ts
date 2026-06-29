// Phase 1-12/13: 트렌드 수집 → 클러스터링 → 테마 생성 서비스.
// TREND_COLLECTION_ENABLED=false이면 mock 데이터를 사용한다.
// TREND_COLLECTION_ENABLED=true이면 네이버/다음 실제 API를 사용한다.

import { getMockTrendItems, rawItemToCandidate } from "./mock-trend-provider";
import { searchNaverNews } from "./naver-client";
import { searchDaumNews } from "./daum-client";
import { SEED_QUERIES } from "./seed-queries";
import { clusterTrendItems } from "./theme-clusterer";
import {
  insertTrendCandidates,
  insertThemeClusters,
  getThemeClusterById,
  updateThemeClusterStatus,
  getRecentTrendCandidates,
  getThemeClusters,
  type InsertTrendCandidateInput,
  type InsertThemeClusterInput,
} from "@/lib/repositories/trend-repository";
import { createTheme } from "@/lib/repositories/theme-repository";
import { logEvent } from "@/lib/repositories/log-repository";
import type { TrendCandidate, ThemeCluster, Theme } from "@/lib/types/domain";
import type { TrendSearchResult } from "./types";

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
 */
async function collectFromDaum(now: string): Promise<PlatformCollectionResult> {
  await logEvent({
    type: "daum_trend_collection_started",
    status: "info",
    message: "다음(카카오) 뉴스 수집 시작",
    details: { queryCount: SEED_QUERIES.length },
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

  const results = await Promise.allSettled(
    SEED_QUERIES.map((q) => searchDaumNews(q, 5))
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
    type: status === "success" ? "daum_trend_collection_completed" : "daum_trend_collection_failed",
    status,
    message: `다음 수집 완료: ${inputs.length}건 (실패 query ${failCount}건)`,
    details: { count: inputs.length, failCount },
  });

  return { inputs, status, count: inputs.length, error: errors[0] };
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

    const allInputs = deduplicateByUrl([...naverResult.inputs, ...daumResult.inputs]);

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
      message: `트렌드 후보 ${saved.length}건 수집 완료 (네이버 ${naverCount}건, 다음 ${daumCount}건)`,
      details: { count: saved.length, mode: "api", naverCount, daumCount },
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

  const inputs: InsertThemeClusterInput[] = clusterCandidates.map((c) => ({
    title: c.group.title,
    description: c.group.description,
    keywords: c.matchedKeywords.slice(0, 5),
    naverCount: c.naverCount,
    daumCount: c.daumCount,
    score: c.score,
  }));

  const saved = await insertThemeClusters(inputs);

  await logEvent({
    type: "theme_clustering_completed",
    status: "success",
    message: `테마 클러스터 ${saved.length}건 생성`,
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
export async function getTrendPageData(): Promise<{
  candidates: TrendCandidate[];
  clusters: ThemeCluster[];
}> {
  const [candidates, clusters] = await Promise.all([
    getRecentTrendCandidates(50),
    getThemeClusters(),
  ]);
  return { candidates, clusters };
}
