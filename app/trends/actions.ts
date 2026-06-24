"use server";

import { revalidatePath } from "next/cache";
import {
  collectTrendCandidates,
  clusterCommonThemes,
  createThemeFromCluster,
} from "@/lib/trends/trend-service";

export interface TrendActionResult {
  success: boolean;
  message: string;
  data?: unknown;
  error?: string;
}

/** 트렌드 후보 수집 + 클러스터링을 한 번에 실행한다. */
export async function runTrendCollection(): Promise<TrendActionResult> {
  try {
    const candidates = await collectTrendCandidates();
    const clusters = await clusterCommonThemes();

    revalidatePath("/trends");

    return {
      success: true,
      message: `트렌드 후보 ${candidates.length}건 수집, 공통 테마 ${clusters.length}건 추출 완료`,
      data: { candidateCount: candidates.length, clusterCount: clusters.length },
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, message: "트렌드 수집에 실패했습니다.", error };
  }
}

/** 선택한 클러스터를 themes 테이블에 저장하고 dashboard로 이동할 themeId를 반환한다. */
export async function selectClusterAsTheme(
  clusterId: string
): Promise<TrendActionResult> {
  try {
    const theme = await createThemeFromCluster(clusterId);

    revalidatePath("/trends");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `테마 "${theme.title}" 생성 완료. 대시보드에서 출처를 등록하세요.`,
      data: { themeId: theme.id },
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, message: "테마 생성에 실패했습니다.", error };
  }
}
