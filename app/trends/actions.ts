"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

/** redirect()가 내부적으로 던지는 NEXT_REDIRECT 특수 예외인지 확인한다 (digest 기반). */
function isNextRedirectError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest: unknown }).digest === "string" &&
    (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

/** 트렌드 후보 수집 + 클러스터링을 한 번에 실행하고 결과를 query param으로 redirect한다. */
export async function runTrendCollection(): Promise<void> {
  try {
    const result = await collectTrendCandidates();
    const clusters = await clusterCommonThemes();

    revalidatePath("/trends");

    const params = new URLSearchParams({
      msg: `트렌드 후보 ${result.candidates.length}건 수집, 공통 테마 ${clusters.length}건 추출 완료`,
      type: "success",
      naverStatus: result.naverStatus,
      daumStatus: result.daumStatus,
      naverCount: String(result.naverCount),
      daumCount: String(result.daumCount),
    });
    if (result.naverError) params.set("naverError", result.naverError.substring(0, 150));
    if (result.daumError) params.set("daumError", result.daumError.substring(0, 150));

    redirect(`/trends?${params.toString()}`);
  } catch (err) {
    // redirect()가 던지는 NEXT_REDIRECT 예외는 그대로 다시 던져야 실제 리다이렉트가 수행된다.
    // 여기서 잡아버리면 "NEXT_REDIRECT" 문자열이 에러 메시지로 화면에 노출된다.
    if (isNextRedirectError(err)) throw err;

    const error = err instanceof Error ? err.message : String(err);
    revalidatePath("/trends");
    redirect(`/trends?msg=${encodeURIComponent(error)}&type=error`);
  }
}

/** 선택한 클러스터를 themes 테이블에 저장하고 dashboard로 redirect한다. */
export async function selectClusterAsTheme(clusterId: string): Promise<TrendActionResult> {
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
