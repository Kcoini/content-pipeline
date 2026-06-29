"use server";

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

/** 테마 키워드 기반 기사 URL 후보를 수집한다. */
export async function collectCandidates(themeId: string): Promise<ThemeActionResult> {
  try {
    const theme = await getThemeById(themeId);
    if (!theme) {
      return { success: false, message: "테마를 찾을 수 없습니다.", error: "NOT_FOUND" };
    }

    const candidates = await collectArticleUrlCandidates(theme);

    revalidatePath(`/themes/${themeId}`);

    return {
      success: true,
      message: `기사 URL 후보 ${candidates.length}건 수집 완료`,
      data: { count: candidates.length },
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, message: "URL 후보 수집에 실패했습니다.", error };
  }
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
