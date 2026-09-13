"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  collectTrendCandidates,
  clusterCommonThemes,
  createThemeFromCluster,
  addClusterEvidenceToExistingTheme,
  dismissThemeClusterCandidate,
  logThemeCandidateSelectionOutcome,
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

/**
 * Phase 1-24: merged/duplicate 후보 클릭 시 "선택 불가"로 끝내지 않고
 * 대표 후보(대표 테마)를 대신 선택한다. selectClusterAsTheme와 동작은
 * 같지만, "병합된 후보를 대신 대표 후보로 연결했다"는 로그를 남긴다.
 */
export async function selectCanonicalClusterForMergedCandidate(
  mergedCandidateId: string,
  representativeClusterId: string
): Promise<TrendActionResult> {
  await logThemeCandidateSelectionOutcome({
    clusterId: mergedCandidateId,
    outcome: "merged_redirected_to_canonical",
    canonicalClusterId: representativeClusterId,
  });
  return selectClusterAsTheme(representativeClusterId);
}

/** 오늘 후보를 기존 테마와 다른 새 테마로 분리 생성한다(needs_review/existing_theme_update의 "새 하위 주제로 분리"). */
export async function splitClusterAsNewTheme(clusterId: string): Promise<TrendActionResult> {
  await logThemeCandidateSelectionOutcome({ clusterId, outcome: "split_as_new_theme" });
  return selectClusterAsTheme(clusterId);
}

/** duplicate_theme 후보를 클릭했을 때 "기존 테마 보기"로 연결한다(무반응 방지). */
export async function goToExistingThemeFromDuplicate(
  clusterId: string,
  existingThemeId: string
): Promise<void> {
  await logThemeCandidateSelectionOutcome({
    clusterId,
    outcome: "duplicate_redirected_to_existing",
    existingThemeId,
  });
  redirect(`/dashboard?themeId=${existingThemeId}`);
}

/** duplicate_theme 후보를 "다시 표시하지 않기" 처리한다. */
export async function dismissClusterCandidate(clusterId: string): Promise<void> {
  await dismissThemeClusterCandidate(clusterId);
  revalidatePath("/trends");
  redirect(`/trends?msg=${encodeURIComponent("중복 후보를 다시 표시하지 않도록 처리했습니다.")}&type=success`);
}

/**
 * existing_theme_update 후보의 새 출처를 기존 테마에 추가한다. 결과를
 * query param으로 넘겨 /trends에서 "추가 결과 요약 + 다음 작업" 카드를
 * 보여준다(추가 후 무반응 상태로 끝내지 않는다).
 */
export async function addClusterToExistingTheme(
  clusterId: string,
  existingThemeId: string
): Promise<void> {
  try {
    const result = await addClusterEvidenceToExistingTheme(clusterId, existingThemeId);
    revalidatePath("/trends");
    revalidatePath("/dashboard");

    const params = new URLSearchParams({
      updateClusterId: clusterId,
      updateThemeId: result.themeId,
      updateThemeTitle: result.themeTitle,
      updateAdded: String(result.addedCount),
      updateSkipped: String(result.skippedDuplicateCount),
      updateFailed: String(result.failedCount),
    });
    redirect(`/trends?${params.toString()}`);
  } catch (err) {
    if (isNextRedirectError(err)) throw err;
    const error = err instanceof Error ? err.message : String(err);
    redirect(`/trends?msg=${encodeURIComponent(`기존 테마 업데이트에 실패했습니다: ${error}`)}&type=error`);
  }
}
