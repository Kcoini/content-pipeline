"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { runContractForCollection } from "@/lib/harness/contract-runner";
import { loadContract } from "@/lib/harness/load-contract";
import { logEvent } from "@/lib/harness/logger";
import { generateMockArticle } from "@/lib/ai/generate-article";
import { getStore, getSourcesByThemeId, getThemeById } from "@/lib/store/memory-store";
import type { Article, Language, Source, Theme } from "@/lib/types/domain";

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

  const theme: Theme = {
    id: randomUUID(),
    title,
    description,
    keywords,
    language,
    createdAt: new Date().toISOString(),
  };

  getStore().themes.push(theme);

  logEvent({
    type: "theme_created",
    status: "success",
    message: `테마가 생성되었습니다: ${theme.title}`,
    details: { themeId: theme.id, title: theme.title, language: theme.language },
  });

  revalidatePath("/dashboard");
  redirect(`/dashboard?themeId=${theme.id}`);
}

/**
 * 출처 등록 - FR-2, FR-3
 */
export async function addSource(formData: FormData): Promise<void> {
  const themeId = String(formData.get("themeId") ?? "");
  const theme = getThemeById(themeId);
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

  const source: Source = {
    id: randomUUID(),
    themeId,
    url,
    title,
    publisher,
    publishedAt,
    summary,
    createdAt: new Date().toISOString(),
  };

  getStore().sources.push(source);

  logEvent({
    type: "source_added",
    status: "success",
    message: `출처가 등록되었습니다: ${source.title || source.url || "(제목 없음)"}`,
    details: { themeId, sourceId: source.id, url: source.url, title: source.title },
  });

  revalidatePath("/dashboard");
  redirect(`/dashboard?themeId=${themeId}`);
}

/**
 * 계약 검사 + (통과 시) mock 기사 초안 생성 - FR-4~7
 */
export async function generateArticleDraft(formData: FormData): Promise<void> {
  const themeId = String(formData.get("themeId") ?? "");
  const theme = getThemeById(themeId);
  if (!theme) {
    redirect("/dashboard");
  }

  const store = getStore();
  const sources = getSourcesByThemeId(themeId);

  // 1) source.contract.yaml 검사 (FR-6, FR-7)
  const sourceContract = loadContract("source.contract.yaml");
  const sourceItems = sources as unknown as Record<string, unknown>[];
  const sourceResult = runContractForCollection(sourceContract, sourceItems, {
    collections: { topic_sources: sourceItems },
  });

  store.contractChecks.push({
    themeId,
    target: "source",
    contractName: sourceContract.name,
    result: sourceResult,
    checkedAt: new Date().toISOString(),
  });

  logEvent({
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
  });

  if (!sourceResult.passed) {
    // 출처가 3개 미만이거나 url/중복 등의 문제가 있으면 기사 생성 단계로 진행하지 않는다.
    revalidatePath("/dashboard");
    redirect(`/dashboard?themeId=${themeId}`);
  }

  // 2) mock 기사 초안 생성 (FR-4, FR-5)
  const generated = generateMockArticle(theme, sources);
  const article: Article = {
    id: randomUUID(),
    themeId,
    title: generated.title,
    content: generated.content,
    status: "draft",
    citedSourceIds: generated.citedSourceIds,
    createdAt: new Date().toISOString(),
  };

  // 3) article.contract.yaml 검사 (FR-7)
  const articleContract = loadContract("article.contract.yaml");
  const citedSources = sources.filter((source) => article.citedSourceIds.includes(source.id));
  const articleItem: Record<string, unknown> = {
    title: article.title,
    content: article.content,
    topicId: article.themeId,
    status: article.status,
  };
  const articleResult = runContractForCollection(articleContract, [articleItem], {
    collections: {
      article_sources: citedSources as unknown as Record<string, unknown>[],
    },
    operation: "create",
  });

  store.contractChecks.push({
    themeId,
    target: "article",
    contractName: articleContract.name,
    result: articleResult,
    checkedAt: new Date().toISOString(),
  });

  logEvent({
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
  });

  if (!articleResult.passed) {
    revalidatePath("/dashboard");
    redirect(`/dashboard?themeId=${themeId}`);
  }

  // 4) draft 상태로 저장 (이전 초안은 새 초안으로 교체)
  store.articles = store.articles.filter((existing) => existing.themeId !== themeId);
  store.articles.push(article);

  logEvent({
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
  });

  revalidatePath("/dashboard");
  redirect(`/dashboard?themeId=${themeId}`);
}
