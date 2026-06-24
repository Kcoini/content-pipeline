// Phase 1-12: 트렌드 수집 → 클러스터링 → 테마 생성 서비스.
// TREND_COLLECTION_ENABLED=false이면 mock 데이터를 사용한다.

import { getMockTrendItems, rawItemToCandidate } from "./mock-trend-provider";
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

function isTrendEnabled(): boolean {
  return process.env.TREND_COLLECTION_ENABLED === "true";
}

/**
 * 트렌드 후보를 수집해 trend_candidates에 저장한다.
 * TREND_COLLECTION_ENABLED=false이면 mock 데이터를 사용한다.
 */
export async function collectTrendCandidates(): Promise<TrendCandidate[]> {
  await logEvent({
    type: "trend_collection_started",
    status: "info",
    message: isTrendEnabled()
      ? "실제 API로 트렌드 수집 시작"
      : "mock 모드로 트렌드 수집 시작",
    details: { mode: isTrendEnabled() ? "api" : "mock" },
  });

  try {
    const now = new Date().toISOString();
    let inputs: InsertTrendCandidateInput[];

    if (!isTrendEnabled()) {
      const mockItems = getMockTrendItems();
      inputs = mockItems.map((item) => {
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
    } else {
      // 실제 API 연결 (Phase 1-12 이후 구현)
      throw new Error(
        "실제 API 수집은 아직 구현되지 않았습니다. TREND_COLLECTION_ENABLED=false로 설정하세요."
      );
    }

    const saved = await insertTrendCandidates(inputs);

    await logEvent({
      type: "trend_collection_completed",
      status: "success",
      message: `트렌드 후보 ${saved.length}건 수집 완료`,
      details: { count: saved.length, mode: isTrendEnabled() ? "api" : "mock" },
    });

    return saved;
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

  const candidates = await getRecentTrendCandidates(100);

  // RawTrendItem 형태로 변환 (platform + keyword + title + snippet)
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
    getRecentTrendCandidates(30),
    getThemeClusters(),
  ]);
  return { candidates, clusters };
}
