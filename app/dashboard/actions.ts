"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { runContractForCollection } from "@/lib/harness/contract-runner";
import { loadContract } from "@/lib/harness/load-contract";
import { logEvent } from "@/lib/harness/logger";
import { generateAiArticleDraft, generateMockArticleDraft, type GeneratedArticle } from "@/lib/ai/article-writer";
import { summarizeSourcesMock, summarizeSourcesWithAi } from "@/lib/ai/source-summarizer";
import { evaluateArticleMock, evaluateArticleWithAi } from "@/lib/ai/eval-article";
import { getAiProvider, shouldUseAnthropic } from "@/lib/ai/ai-config";
import { toAiErrorMessage } from "@/lib/ai/ai-errors";
import { recordContractCheck } from "@/lib/repositories/log-repository";
import { createTheme as createThemeRecord, getThemeById } from "@/lib/repositories/theme-repository";
import { addSource as addSourceRecord, getSourcesByThemeId } from "@/lib/repositories/source-repository";
import { saveDraftArticle } from "@/lib/repositories/article-repository";
import { saveEvalRun } from "@/lib/repositories/eval-repository";
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

  // 2) AI mode 여부 확인 후 출처 요약 + 기사 초안 생성 (FR-4, FR-5)
  const aiMode = shouldUseAnthropic();

  await logEvent({
    type: "ai_mode_selected",
    status: "info",
    message: aiMode
      ? `AI 기사 생성 모드(${getAiProvider()})로 진행합니다.`
      : "mock 기사 생성 모드로 진행합니다.",
    details: { themeId, aiMode, provider: getAiProvider() },
    themeId,
  });

  let usedAiMode = aiMode;
  let sourceSummaries = summarizeSourcesMock(sources);
  let generated: GeneratedArticle;

  if (aiMode) {
    try {
      await logEvent({
        type: "source_summary_started",
        status: "info",
        message: "AI 출처 요약을 시작합니다.",
        themeId,
      });
      sourceSummaries = await summarizeSourcesWithAi(theme, sources);
      await logEvent({
        type: "source_summary_completed",
        status: "success",
        message: "AI 출처 요약을 완료했습니다.",
        details: { themeId, sourceCount: sourceSummaries.length },
        themeId,
      });

      await logEvent({
        type: "article_generation_started",
        status: "info",
        message: "AI 기사 초안 생성을 시작합니다.",
        themeId,
      });
      generated = await generateAiArticleDraft(theme, sourceSummaries);
      await logEvent({
        type: "article_generation_completed",
        status: "success",
        message: "AI 기사 초안 생성을 완료했습니다.",
        details: {
          themeId,
          contentLength: generated.content.length,
          citedSourceIds: generated.citedSourceIds,
        },
        themeId,
      });
    } catch (error) {
      const reason = toAiErrorMessage(error);
      await logEvent({
        type: "ai_generation_failed",
        status: "failed",
        message: `AI 기사 생성에 실패하여 mock 생성으로 전환합니다: ${reason}`,
        details: { themeId, error: reason },
        themeId,
      });

      usedAiMode = false;
      sourceSummaries = summarizeSourcesMock(sources);
      generated = generateMockArticleDraft(theme, sources);
    }
  } else {
    generated = generateMockArticleDraft(theme, sources);
  }

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
    articleId: article.id,
    targetType: "article",
    targetId: article.id,
  });

  // 5) AI Evals (FR-8) - mock 모드에서는 evaluateArticleMock, AI 모드에서는
  // evaluateArticleWithAi를 사용한다. evaluateArticleWithAi는 실패 시에도
  // 예외를 던지지 않고 passed=false 결과를 반환한다.
  await logEvent({
    type: "article_eval_started",
    status: "info",
    message: "기사 품질 평가를 시작합니다.",
    details: { themeId, articleId: article.id },
    themeId,
    articleId: article.id,
    targetType: "article",
    targetId: article.id,
  });

  const citedSummaries = sourceSummaries.filter((summary) =>
    article.citedSourceIds.includes(summary.sourceId)
  );

  const evalResult = usedAiMode
    ? await evaluateArticleWithAi({ title: article.title, content: article.content }, citedSummaries)
    : evaluateArticleMock({ title: article.title, content: article.content }, citedSummaries);

  await saveEvalRun({
    articleId: article.id,
    evalName: "article-quality.v1.eval",
    result: evalResult,
  });

  await logEvent({
    type: "article_eval_completed",
    status: evalResult.passed ? "success" : "failed",
    message: evalResult.passed
      ? "기사 품질 평가를 통과했습니다."
      : "기사 품질 평가를 통과하지 못했습니다.",
    details: {
      themeId,
      articleId: article.id,
      aggregateScore: evalResult.aggregateScore,
      passed: evalResult.passed,
      notes: evalResult.notes,
    },
    themeId,
    articleId: article.id,
    targetType: "article",
    targetId: article.id,
  });

  if (!evalResult.passed) {
    const copyRiskScore = evalResult.criteriaScores["copy-risk"]?.score ?? 0;
    const synthesisScore = evalResult.criteriaScores["synthesis"]?.score ?? 0;
    const warningReasons: string[] = [];
    if (copyRiskScore >= 4) warningReasons.push(`복사 위험 높음 (copy-risk: ${copyRiskScore}점)`);
    if (synthesisScore < 2) warningReasons.push(`종합성 부족 (synthesis: ${synthesisScore}점)`);
    if (warningReasons.length === 0) warningReasons.push(`종합 점수 미달 (${evalResult.aggregateScore.toFixed(2)}점)`);

    await logEvent({
      type: "article_quality_warning",
      status: "failed",
      message: `기사 품질 검토가 필요합니다: ${warningReasons.join(", ")}`,
      details: {
        themeId,
        articleId: article.id,
        aggregateScore: evalResult.aggregateScore,
        copyRiskScore,
        synthesisScore,
        notes: evalResult.notes,
      },
      themeId,
      articleId: article.id,
      targetType: "article",
      targetId: article.id,
    });
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard?themeId=${themeId}`);
}
