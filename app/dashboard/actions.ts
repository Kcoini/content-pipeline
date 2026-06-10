"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { runContractForCollection } from "@/lib/harness/contract-runner";
import { loadContract } from "@/lib/harness/load-contract";
import { logEvent } from "@/lib/harness/logger";
import { generateMockArticle } from "@/lib/ai/generate-article";
import { recordContractCheck } from "@/lib/repositories/log-repository";
import { createTheme as createThemeRecord, getThemeById } from "@/lib/repositories/theme-repository";
import { addSource as addSourceRecord, getSourcesByThemeId } from "@/lib/repositories/source-repository";
import { saveDraftArticle } from "@/lib/repositories/article-repository";
import type { Language } from "@/lib/types/domain";

function parseKeywords(raw: string): string[] {
  return raw
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

/**
 * 주제(테마) 생성 - FR-1
 */
export async function createTheme(formData: FormData): Promise<void> {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) {
    // 제목이 비어있으면 아무 작업도 하지 않고 대시보드로 돌아간다 (UI에서도 required 처리).
    redirect("/dashboard");
  }

  const description = String(formData.get("description") ?? "").trim();
  const keywords = parseKeywords(String(formData.get("keywords") ?? ""));
  const language = (String(formData.get("language") ?? "ko") as Language) === "en" ? "en" : "ko";

  const theme = await createThemeRecord({ title, description, keywords, language });

  await logEvent({
    type: "theme_created",
    status: "success",
    message: `테마가 생성되었습니다: ${theme.title}`,
    details: { themeId: theme.id, title: theme.title, language: theme.language },
    themeId: theme.id,
  });

  revalidatePath("/dashboard");
  redirect(`/dashboard?themeId=${theme.id}`);
}

/**
 * 출처 등록 - FR-2, FR-3
 */
export async function addSource(formData: FormData): Promise<void> {
  const themeId = String(formData.get("themeId") ?? "");
  const theme = await getThemeById(themeId);
  if (!theme) {
    redirect("/dashboard");
  }

  const url = String(formData.get("url") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const publisher = String(formData.get("publisher") ?? "").trim();
  const publishedAt = String(formData.get("publishedAt") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();

  if (!url && !title) {
    // 둘 다 비어있는 빈 제출은 무시한다.
    redirect(`/dashboard?themeId=${themeId}`);
  }

  const source = await addSourceRecord({ themeId, url, title, publisher, publishedAt, summary });

  await logEvent({
    type: "source_added",
    status: "success",
    message: `출처가 등록되었습니다: ${source.title || source.url || "(제목 없음)"}`,
    details: { themeId, sourceId: source.id, url: source.url, title: source.title },
    themeId,
  });

  revalidatePath("/dashboard");
  redirect(`/dashboard?themeId=${themeId}`);
}

/**
 * 계약 검사 + (통과 시) mock 기사 초안 생성 - FR-4~7
 */
export async function generateArticleDraft(formData: FormData): Promise<void> {
  const themeId = String(formData.get("themeId") ?? "");
  const theme = await getThemeById(themeId);
  if (!theme) {
    redirect("/dashboard");
  }

  const sources = await getSourcesByThemeId(themeId);

  // 1) source.contract.yaml 검사 (FR-6, FR-7)
  const sourceContract = loadContract("source.contract.yaml");
  const sourceItems = sources as unknown as Record<string, unknown>[];
  const sourceResult = runContractForCollection(sourceContract, sourceItems, {
    collections: { topic_sources: sourceItems },
  });

  await recordContractCheck({
    themeId,
    target: "source",
    contractName: sourceContract.name,
    passed: sourceResult.passed,
    violations: sourceResult.violations,
    sourceCount: sources.length,
  });

  await logEvent({
    type: "contract_checked",
    status: sourceResult.passed ? "success" : "failed",
    message: sourceResult.passed
      ? "출처 계약 검사를 통과했습니다."
      : `출처 계약 검사에 실패했습니다 (${sourceResult.violations.length}건).`,
    details: {
      themeId,
      contractName: sourceContract.name,
      passed: sourceResult.passed,
      violations: sourceResult.violations,
    },
    themeId,
  });

  if (!sourceResult.passed) {
    // 출처가 3개 미만이거나 url/중복 등의 문제가 있으면 기사 생성 단계로 진행하지 않는다.
    revalidatePath("/dashboard");
    redirect(`/dashboard?themeId=${themeId}`);
  }

  // 2) mock 기사 초안 생성 (FR-4, FR-5)
  const generated = generateMockArticle(theme, sources);

  // 3) article.contract.yaml 검사 (FR-7)
  const articleContract = loadContract("article.contract.yaml");
  const citedSources = sources.filter((source) => generated.citedSourceIds.includes(source.id));
  const articleItem: Record<string, unknown> = {
    title: generated.title,
    content: generated.content,
    topicId: themeId,
    status: "draft",
  };
  const articleResult = runContractForCollection(articleContract, [articleItem], {
    collections: {
      article_sources: citedSources as unknown as Record<string, unknown>[],
    },
    operation: "create",
  });

  await recordContractCheck({
    themeId,
    target: "article",
    contractName: articleContract.name,
    passed: articleResult.passed,
    violations: articleResult.violations,
    sourceCount: citedSources.length,
  });

  await logEvent({
    type: "contract_checked",
    status: articleResult.passed ? "success" : "failed",
    message: articleResult.passed
      ? "기사 초안 계약 검사를 통과했습니다."
      : `기사 초안 계약 검사에 실패했습니다 (${articleResult.violations.length}건).`,
    details: {
      themeId,
      contractName: articleContract.name,
      passed: articleResult.passed,
      violations: articleResult.violations,
    },
    themeId,
  });

  if (!articleResult.passed) {
    revalidatePath("/dashboard");
    redirect(`/dashboard?themeId=${themeId}`);
  }

  // 4) draft 상태로 저장 (이전 초안은 새 초안으로 교체)
  const article = await saveDraftArticle({
    themeId,
    title: generated.title,
    content: generated.content,
    citedSourceIds: generated.citedSourceIds,
  });

  await logEvent({
    type: "article_draft_created",
    status: "success",
    message: `기사 초안이 생성되었습니다: ${article.title} (status=${article.status})`,
    details: {
      themeId,
      articleId: article.id,
      status: article.status,
      citedSourceIds: article.citedSourceIds,
      contentLength: article.content.length,
    },
    themeId,
  });

  revalidatePath("/dashboard");
  redirect(`/dashboard?themeId=${themeId}`);
}
