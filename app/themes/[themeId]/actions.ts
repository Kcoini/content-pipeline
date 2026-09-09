"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { collectArticleUrlCandidates, dismissArticleUrlCandidate } from "@/lib/article-search/article-search-service";
import { getArticleUrlCandidateById, updateArticleUrlCandidateStatus } from "@/lib/repositories/article-url-candidate-repository";
import { addSource, DuplicateSourceError, getSourcesByThemeId } from "@/lib/repositories/source-repository";
import { fetchUrlContent } from "@/lib/services/url-fetcher";
import { updateSourceFetchResult } from "@/lib/repositories/source-repository";
import { generateSourceSummaryWithAi, generateSourceSummaryMock } from "@/lib/ai/source-auto-summarizer";
import { updateSourceSummary, skipSourceSummary } from "@/lib/repositories/source-repository";
import { getThemeById } from "@/lib/repositories/theme-repository";
import { shouldUseAnthropic } from "@/lib/ai/ai-config";
import { logEvent } from "@/lib/repositories/log-repository";

export interface ThemeActionResult {
  success: boolean;
  message: string;
  data?: unknown;
  error?: string;
}

/** `?collectStatus=`로 표시하는 이번 실행의 수집 결과 상태. */
export type CollectionStatusParam = "success" | "partial" | "none" | "error";

/**
 * Phase 3-27: 테마 키워드 기반 기사 URL 후보를 수집한다.
 *
 * 이전에는 이 action이 결과를 반환만 하고, 페이지의 inline server action
 * closure가 그 반환값을 그대로 버렸다 — 버튼을 눌러도 페이지가 조용히
 * 다시 렌더링될 뿐 성공/실패/개수를 전혀 알 수 없는 "무반응" 문제가
 * 있었다. 이제 top-level form action(FormData)으로 바꾸고, 결과를
 * query string에 담아 같은 페이지로 redirect한다 — 페이지는 그 값으로
 * `RelatedUrlCollectionResultCard`를 렌더링한다.
 */
export async function collectCandidates(formData: FormData): Promise<void> {
  const themeId = String(formData.get("themeId") ?? "");
  // "initial": 최초 수집 버튼 / "add_more": 결과 화면의 "추가로 기사 URL 수집" 버튼.
  const trigger = String(formData.get("trigger") ?? "initial");

  if (!themeId) {
    redirect(`/themes/${themeId}?collectStatus=error&collectError=${encodeURIComponent("테마 정보를 찾을 수 없습니다.")}`);
  }

  if (trigger === "add_more") {
    await logEvent({
      type: "related_url_collection_add_more_clicked",
      status: "info",
      message: "사용자가 추가로 기사 URL 수집을 요청했습니다.",
      themeId,
      details: { themeId },
    });
  }

  await logEvent({
    type: "related_url_collection_started",
    status: "info",
    message: "관련 기사 URL 수집을 시작합니다.",
    themeId,
    details: { themeId, trigger },
  });

  let status: CollectionStatusParam;
  let newCount = 0;
  let duplicateCount = 0;
  let errorMessage = "";

  try {
    const theme = await getThemeById(themeId);
    if (!theme) throw new Error("테마를 찾을 수 없습니다.");

    const result = await collectArticleUrlCandidates(theme);
    newCount = result.saved.length;
    duplicateCount = result.duplicateCount;

    if (newCount === 0) {
      status = "none";
      await logEvent({
        type: "related_url_collection_no_results",
        status: "info",
        message: "새로 등록할 기사 URL을 찾지 못했습니다.",
        themeId,
        details: { themeId, totalFound: result.totalFound, duplicateCount },
      });
    } else if (result.failedTaskCount > 0) {
      status = "partial";
      await logEvent({
        type: "related_url_collection_partial_success",
        status: "info",
        message: `일부 검색만 성공했습니다 (성공 ${result.attemptedTaskCount - result.failedTaskCount}/${result.attemptedTaskCount}).`,
        themeId,
        details: {
          themeId,
          newCount,
          duplicateCount,
          attemptedTaskCount: result.attemptedTaskCount,
          failedTaskCount: result.failedTaskCount,
        },
      });
    } else {
      status = "success";
    }

    await logEvent({
      type: "related_url_collection_completed",
      status: "success",
      message: `관련 기사 URL 수집 완료 (신규 ${newCount}건, 중복 ${duplicateCount}건).`,
      themeId,
      details: { themeId, status, newCount, duplicateCount },
    });
  } catch (err) {
    status = "error";
    errorMessage = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    await logEvent({
      type: "related_url_collection_failed",
      status: "failed",
      message: `관련 기사 URL 수집 실패: ${errorMessage}`,
      themeId,
      details: { themeId, reason: errorMessage },
    });
  }

  revalidatePath(`/themes/${themeId}`);

  const params = new URLSearchParams({
    collectStatus: status,
    collectNew: String(newCount),
    collectDup: String(duplicateCount),
  });
  if (status === "error" && errorMessage) params.set("collectError", errorMessage);
  redirect(`/themes/${themeId}?${params.toString()}#collection-result`);
}

/** 결과 화면의 "이 정도로 충분합니다" — 수집을 종료하고 다음 단계 안내로 바꾼다. */
export async function finishUrlCollection(formData: FormData): Promise<void> {
  const themeId = String(formData.get("themeId") ?? "");
  await logEvent({
    type: "related_url_collection_finished_by_user",
    status: "info",
    message: "사용자가 관련 기사 URL 수집을 종료했습니다.",
    themeId,
    details: { themeId },
  });
  redirect(`/themes/${themeId}?collectStatus=finished#collection-result`);
}

/** 결과 화면의 "대시보드로 돌아가기". */
export async function goDashboardFromUrlCollection(formData: FormData): Promise<void> {
  const themeId = String(formData.get("themeId") ?? "");
  await logEvent({
    type: "related_url_collection_go_dashboard_clicked",
    status: "info",
    message: "사용자가 대시보드로 이동했습니다.",
    themeId,
    details: { themeId },
  });
  redirect(`/dashboard?themeId=${themeId}`);
}

/** 결과 화면의 "글 생성 단계로 진행". */
export async function goGenerateFromUrlCollection(formData: FormData): Promise<void> {
  const themeId = String(formData.get("themeId") ?? "");
  await logEvent({
    type: "related_url_collection_go_generate_clicked",
    status: "info",
    message: "사용자가 글 생성 단계로 이동했습니다.",
    themeId,
    details: { themeId },
  });
  redirect(`/dashboard?themeId=${themeId}#generate-draft`);
}

/** 선택한 후보들을 sources에 등록하고 URL fetch + 자동 요약을 실행한다. */
export async function importCandidatesToSources(
  formData: FormData
): Promise<ThemeActionResult> {
  const themeId = formData.get("themeId") as string;
  const candidateIds = formData.getAll("candidateIds") as string[];

  if (!themeId || candidateIds.length === 0) {
    return { success: false, message: "선택된 후보가 없습니다.", error: "NO_SELECTION" };
  }

  const aiMode = shouldUseAnthropic();
  const results = { imported: 0, duplicate: 0, failed: 0 };

  // 현재 등록된 sources URL 목록 (중복 체크용)
  const existingSources = await getSourcesByThemeId(themeId);
  const existingUrls = new Set(existingSources.map((s) => s.url));

  for (const candidateId of candidateIds) {
    const candidate = await getArticleUrlCandidateById(candidateId);
    if (!candidate) continue;

    // 중복 URL 체크
    if (existingUrls.has(candidate.url)) {
      results.duplicate++;
      continue;
    }

    try {
      await logEvent({
        type: "article_url_candidate_selected",
        status: "info",
        message: `URL 후보 선택: ${candidate.title ?? candidate.url}`,
        themeId,
        details: { candidateId, url: candidate.url },
      });

      // sources에 등록
      const source = await addSource({
        themeId,
        url: candidate.url,
        title: candidate.title ?? "",
        publisher: candidate.publisher ?? "",
        publishedAt: candidate.publishedAt ? candidate.publishedAt.slice(0, 10) : "",
        summary: "",
        metadata: {
          collection_method: "article_url_candidate",
          article_url_candidate_id: candidateId,
          platform: candidate.platform,
        },
      });

      existingUrls.add(candidate.url);

      await logEvent({
        type: "source_created_from_candidate",
        status: "success",
        message: `출처 등록 완료: ${source.title || source.url}`,
        themeId,
        details: { sourceId: source.id, candidateId },
      });

      // URL fetch
      const fetchResult = await fetchUrlContent(source.url);
      await updateSourceFetchResult(source.id, fetchResult, source.title);

      // 자동 요약 (fetch 성공 시)
      if (fetchResult.status === "success" && fetchResult.rawContent) {
        try {
          const summaryResult = aiMode
            ? await generateSourceSummaryWithAi(source, fetchResult.rawContent)
            : generateSourceSummaryMock(source);
          await updateSourceSummary(source.id, summaryResult, "success");
        } catch {
          await skipSourceSummary(source.id);
        }
      } else {
        await skipSourceSummary(source.id);
      }

      // 후보 상태를 imported로 변경
      await updateArticleUrlCandidateStatus(candidateId, "imported");

      await logEvent({
        type: "article_url_candidate_imported",
        status: "success",
        message: `후보 import 완료: ${candidate.url}`,
        themeId,
        details: { candidateId, sourceId: source.id },
      });

      results.imported++;
    } catch (err) {
      if (err instanceof DuplicateSourceError) {
        results.duplicate++;
      } else {
        results.failed++;
      }
    }
  }

  revalidatePath(`/themes/${themeId}`);
  revalidatePath("/dashboard");

  const parts: string[] = [];
  if (results.imported > 0) parts.push(`${results.imported}건 등록 완료`);
  if (results.duplicate > 0) parts.push(`${results.duplicate}건 중복`);
  if (results.failed > 0) parts.push(`${results.failed}건 실패`);

  return {
    success: results.imported > 0 || results.duplicate > 0,
    message: parts.join(", "),
    data: results,
  };
}

/** 후보를 제외(dismissed) 처리한다. */
export async function dismissCandidate(candidateId: string): Promise<void> {
  await dismissArticleUrlCandidate(candidateId);
  // revalidatePath는 caller가 처리
}
