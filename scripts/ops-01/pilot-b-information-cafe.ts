// OPS-01 Pilot B: 시의성 있는 정보형 콘텐츠(source_based_explainer) +
// naver_cafe. 실제 Supabase/Anthropic을 사용한다 — 사용자가 사전
// 승인했다. 실제 외부 게시(Naver API 호출)는 절대 하지 않는다.
import "./load-env";

import { describe, it, expect } from "vitest";
import { createTheme, getThemeById } from "@/lib/repositories/theme-repository";
import { addSource, updateSourceFetchResult, getSourcesByThemeId } from "@/lib/repositories/source-repository";
import { fetchUrlContent } from "@/lib/services/url-fetcher";
import { generateSourceSummaryWithAi } from "@/lib/ai/source-auto-summarizer";
import { updateSourceSummary } from "@/lib/repositories/source-repository";
import { shouldUseAnthropic, getAiProvider } from "@/lib/ai/ai-config";
import { summarizeSourcesWithAi } from "@/lib/ai/source-summarizer";
import { generateAiArticleDraft } from "@/lib/ai/article-writer";
import { runContractForCollection } from "@/lib/harness/contract-runner";
import { loadContract } from "@/lib/harness/load-contract";
import { saveDraftArticle, approveArticle, getArticleByThemeId } from "@/lib/repositories/article-repository";
import { buildMasterManuscript } from "@/lib/articles/master-manuscript-builder";
import { saveArticleMasterManuscript } from "@/lib/repositories/article-repository";
import { evaluateArticleForMode } from "@/lib/ai/eval-article";
import { saveEvalRun } from "@/lib/repositories/eval-repository";
import { getArticleModeConfig } from "@/lib/articles/article-modes";
import { generateSelectedPlatformPosts } from "@/lib/social/multi-platform-generation-service";
import { getSocialPostById } from "@/lib/repositories/social-posts-repository";
import { rerunSocialPostQualityGate } from "@/lib/social/social-post-service";
import { summarizeAutoReview } from "@/lib/social/social-post-auto-review";
import { runAutoFixAndRecheck } from "@/lib/social/post-auto-fix-service";
import { approveSocialPost } from "@/lib/social/social-post-approval-service";
import { prepareManualPostingRecord } from "@/lib/social/platform-manual-posting-result-service";
import { sanitizeNaverCafePlainText } from "@/lib/social/naver-cafe-plain-text-sanitizer";
import type { SocialPostQualityChecklistItem } from "@/lib/social/social-platform-types";

const APPROVED_BY = "ops-01-pilot-b";
const timings: Record<string, number> = {};
function mark(label: string, startedAt: number) {
  timings[label] = Date.now() - startedAt;
  console.log(`[OPS-01 Pilot B] ${label}: ${timings[label]}ms`);
}

// 실제 공개적으로 확인 가능한 정보성 주제: 한국은행 기준금리 정책
// (날짜/수치/기관명이 명확한 평가 대상 — Pilot B의 목표와 정확히 부합).
const SOURCES = [
  {
    url: "https://ko.wikipedia.org/wiki/한국은행",
    title: "한국은행 - 위키백과",
    publisher: "위키백과",
  },
  {
    url: "https://en.wikipedia.org/wiki/Bank_of_Korea",
    title: "Bank of Korea - Wikipedia",
    publisher: "Wikipedia",
  },
  {
    url: "https://ko.wikipedia.org/wiki/기준금리",
    title: "기준금리 - 위키백과",
    publisher: "위키백과",
  },
];

let themeId = "";
let articleId = "";
let socialPostId = "";

describe("OPS-01 Pilot B: source_based_explainer + naver_cafe", () => {
  it("1) 테마 생성", async () => {
    const t0 = Date.now();
    const theme = await createTheme({
      title: "한국은행 기준금리 정책 이해하기",
      description: "한국은행 기준금리 결정 메커니즘과 최근 통화정책 흐름을 설명하는 정보형 콘텐츠 파일럿(OPS-01 Pilot B).",
      keywords: ["한국은행", "기준금리", "통화정책", "금융통화위원회"],
      language: "ko",
    });
    themeId = theme.id;
    expect(theme.id).toBeTruthy();
    mark("theme_create", t0);
  });

  it("2) 실제 출처 3건 등록 + 본문 수집 + AI 요약", async () => {
    const t0 = Date.now();
    let successCount = 0;
    let failCount = 0;
    for (const s of SOURCES) {
      const source = await addSource({
        themeId,
        url: s.url,
        title: s.title,
        publisher: s.publisher,
        publishedAt: "",
        summary: "",
      });
      const fetchResult = await fetchUrlContent(s.url);
      await updateSourceFetchResult(source.id, fetchResult, source.title);
      console.log(`[OPS-01 Pilot B] source fetch ${s.url} -> status=${fetchResult.status} contentLength=${fetchResult.rawContent?.length ?? 0}`);
      if (fetchResult.status === "success" && fetchResult.rawContent) {
        successCount += 1;
        try {
          const summaryResult = await generateSourceSummaryWithAi(source, fetchResult.rawContent);
          await updateSourceSummary(source.id, summaryResult, "success");
        } catch (error) {
          console.log(`[OPS-01 Pilot B] source summary failed for ${s.url}: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else {
        failCount += 1;
      }
    }
    console.log(`[OPS-01 Pilot B] source fetch summary: success=${successCount} fail=${failCount}`);
    const sources = await getSourcesByThemeId(themeId);
    expect(sources.length).toBe(3);
    mark("sources_add_and_fetch", t0);
  }, 120_000);

  it("3) 출처 계약 검사 통과 확인", async () => {
    const sources = await getSourcesByThemeId(themeId);
    const sourceContract = loadContract("source.contract.yaml");
    const result = runContractForCollection(sourceContract, sources as unknown as Record<string, unknown>[], {
      collections: { topic_sources: sources as unknown as Record<string, unknown>[] },
    });
    console.log(`[OPS-01 Pilot B] source contract passed=${result.passed} violations=${result.violations.length}`);
    expect(result.passed).toBe(true);
  });

  it("4) AI 기사초안 생성(source_based_explainer) + article 계약 검사 + 저장", async () => {
    const t0 = Date.now();
    expect(shouldUseAnthropic()).toBe(true);
    console.log(`[OPS-01 Pilot B] AI provider: ${getAiProvider()}`);

    const theme = await getThemeById(themeId);
    const sources = await getSourcesByThemeId(themeId);
    const sourceSummaries = await summarizeSourcesWithAi(theme!, sources);
    console.log(`[OPS-01 Pilot B] source summaries: ${sourceSummaries.length}`);

    const generated = await generateAiArticleDraft(theme!, sourceSummaries, "source_based_explainer");
    console.log(`[OPS-01 Pilot B] generated title="${generated.title}" contentLength=${generated.content.length} citedSourceIds=${generated.citedSourceIds.length}`);

    const articleContract = loadContract("article.contract.yaml");
    const citedSources = sources.filter((s) => generated.citedSourceIds.includes(s.id));
    const articleResult = runContractForCollection(
      articleContract,
      [{ title: generated.title, content: generated.content, topicId: themeId, status: "draft" }],
      { collections: { article_sources: citedSources as unknown as Record<string, unknown>[] }, operation: "create" }
    );
    console.log(`[OPS-01 Pilot B] article contract passed=${articleResult.passed} violations=${articleResult.violations.length}`);
    expect(articleResult.passed).toBe(true);

    const article = await saveDraftArticle({
      themeId,
      title: generated.title,
      content: generated.content,
      citedSourceIds: generated.citedSourceIds,
      articleMode: "source_based_explainer",
      modeFields: {
        seoTitle: generated.seoTitle,
        metaDescription: generated.metaDescription,
        targetKeyword: generated.targetKeyword,
        secondaryKeywords: generated.secondaryKeywords,
        searchIntent: generated.searchIntent,
        readerPersona: generated.readerPersona,
        adSlots: generated.adSlots,
        internalLinkSuggestions: generated.internalLinkSuggestions,
        monetizationScore: generated.monetizationScore,
        policyRiskScore: generated.policyRiskScore,
      },
    });
    articleId = article.id;
    expect(article.status).toBe("draft");

    try {
      const masterManuscript = buildMasterManuscript(article, citedSources);
      await saveArticleMasterManuscript(article.id, masterManuscript);
    } catch (error) {
      console.log(`[OPS-01 Pilot B] master manuscript save failed(non-blocking): ${error instanceof Error ? error.message : String(error)}`);
    }

    mark("article_generation", t0);
  }, 180_000);

  it("5) AI 품질 평가", async () => {
    const t0 = Date.now();
    const sources = await getSourcesByThemeId(themeId);
    const theme = await getThemeById(themeId);
    void theme;
    const sourceSummaries = await summarizeSourcesWithAi((await getThemeById(themeId))!, sources);
    const article = (await getArticleByThemeId(themeId))!;
    const citedSummaries = sourceSummaries.filter((s) => article.citedSourceIds.includes(s.sourceId));
    const evalResult = await evaluateArticleForMode(
      "source_based_explainer",
      { title: article.title, content: article.content },
      citedSummaries,
      true
    );
    await saveEvalRun({
      articleId: article.id,
      evalName: getArticleModeConfig("source_based_explainer").evalFileName.replace(/\.yaml$/, ""),
      result: evalResult,
    });
    console.log(`[OPS-01 Pilot B] eval passed=${evalResult.passed} aggregateScore=${evalResult.aggregateScore}`);
    mark("article_eval", t0);
  }, 180_000);

  it("6) 기사 승인", async () => {
    const t0 = Date.now();
    const approved = await approveArticle({ articleId, approvedBy: APPROVED_BY });
    expect(approved.status).toBe("reviewed");
    mark("article_approval", t0);
  });

  it("7) naver_cafe 플랫폼 글 생성", async () => {
    const t0 = Date.now();
    const summary = await generateSelectedPlatformPosts({
      articleId,
      platforms: ["naver_cafe"],
      toneMode: "auto_recommended",
    });
    if ("error" in summary) throw new Error(summary.error);
    console.log(`[OPS-01 Pilot B] platform generation: generated=${summary.generatedCount} skipped=${summary.skippedCount} failed=${summary.failedCount}`);
    const outcome = summary.results.find((r) => r.platform === "naver_cafe");
    expect(outcome?.status).toBe("generated");
    socialPostId = outcome!.socialPostId!;
    expect(socialPostId).toBeTruthy();
    mark("social_generation", t0);
  }, 120_000);

  it("8) 자동 검토(quality gate) 실행 + 결과 요약", async () => {
    const t0 = Date.now();
    const result = await rerunSocialPostQualityGate(socialPostId);
    console.log(`[OPS-01 Pilot B] quality gate: ${result.message}`);
    const post = await getSocialPostById(socialPostId);
    const checklist = Array.isArray(post?.qualitySummary?.checklist)
      ? (post!.qualitySummary!.checklist as unknown as SocialPostQualityChecklistItem[])
      : [];
    const review = summarizeAutoReview(checklist);
    console.log(
      `[OPS-01 Pilot B] auto review: qualityStatus=${post?.qualityStatus} passed=${review.counts.passed} needsCheck=${review.counts.needsCheck} needsFix=${review.counts.needsFix} blocked=${review.counts.blocked}`
    );
    for (const item of checklist) {
      console.log(`[OPS-01 Pilot B] checklist item key=${item.key} status=${item.status}`);
    }
    mark("quality_gate", t0);
  }, 60_000);

  it("9) 필요 시 자동 수정 실행 + 재검토(before/after 비교용 원문 스냅샷)", async () => {
    const t0 = Date.now();
    const before = await getSocialPostById(socialPostId);
    const beforeBody = before?.postBody ?? "";
    console.log(`[OPS-01 Pilot B] before auto-fix: qualityStatus=${before?.qualityStatus} bodyLength=${beforeBody.length}`);

    if (before?.qualityStatus === "needs_revision") {
      const result = await runAutoFixAndRecheck(socialPostId);
      console.log(`[OPS-01 Pilot B] auto-fix result: ${result.message}`);
      const after = await getSocialPostById(socialPostId);
      const afterBody = after?.postBody ?? "";
      console.log(`[OPS-01 Pilot B] after auto-fix: qualityStatus=${after?.qualityStatus} bodyLength=${afterBody.length}`);
      console.log(`[OPS-01 Pilot B] body length delta: ${afterBody.length - beforeBody.length}`);
    } else {
      console.log("[OPS-01 Pilot B] auto-fix skipped (질문 필요 없음 — quality_status가 needs_revision이 아님)");
    }
    mark("auto_fix", t0);
  }, 60_000);

  it("10) naver_cafe plain text 잔여물(마크다운/HTML) 확인", async () => {
    const post = await getSocialPostById(socialPostId);
    const body = post?.postBody ?? "";
    const sanitized = sanitizeNaverCafePlainText(body);
    const hasMarkdownHeading = /(^|\n)\s*#{1,6}\s/.test(body);
    const hasBoldMarker = /\*\*[^*]+\*\*/.test(body);
    const hasHtmlTag = /<[a-z][a-z0-9]*[^>]*>/i.test(body);
    console.log(
      `[OPS-01 Pilot B] naver_cafe residue check: markdownHeading=${hasMarkdownHeading} boldMarker=${hasBoldMarker} htmlTag=${hasHtmlTag} sanitizeNoChange=${sanitized === body}`
    );
  });

  it("11) 승인", async () => {
    const t0 = Date.now();
    const result = await approveSocialPost(socialPostId, APPROVED_BY, "OPS-01 Pilot B 파일럿 승인");
    console.log(`[OPS-01 Pilot B] social approval: success=${result.success} message=${result.message}`);
    expect(result.success).toBe(true);
    mark("social_approval", t0);
  });

  it("12) 수동 게시 준비 상태 확인(실제 외부 게시/URL 기록은 하지 않는다)", async () => {
    const result = await prepareManualPostingRecord(socialPostId);
    console.log(`[OPS-01 Pilot B] manual posting prepare: success=${result.success} message=${result.message}`);
    // 실제로는 사용자가 네이버 카페에 직접 게시한 뒤 URL을 넣고
    // recordManualPostingResult를 호출해야 한다 — 이 파일럿은 가짜 URL을
    // DB에 기록해 "게시 완료"를 조작하지 않는다(데이터 정합성 보호).
  });

  it("13) 최종 요약 로그", async () => {
    console.log(`[OPS-01 Pilot B] SUMMARY themeId=${themeId} articleId=${articleId} socialPostId=${socialPostId}`);
    console.log(`[OPS-01 Pilot B] TIMINGS ${JSON.stringify(timings)}`);
  });
});
