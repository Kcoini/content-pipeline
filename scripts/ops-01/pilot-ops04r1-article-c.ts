// OPS-04R1 Article C (Case A: 한국어 source → 한국어 content):
// 실제 WordPress 블로그(장문) 생성 — upstream source evidence
// integrity validator(OPS-04-FIX1)가 실제 생성 시점에도 정상 작동하는지
// 확인하는 소규모 재검증. 실제 Supabase DB / 실제 Anthropic API / 실제
// WordPress 사이트(Draft만). 공개 게시는 호출하지 않는다.
import "./load-env";

import { describe, it, expect } from "vitest";
import { createTheme, getThemeById } from "@/lib/repositories/theme-repository";
import { addSource, getSourcesByThemeId, updateSourceFetchResult, updateSourceSummary } from "@/lib/repositories/source-repository";
import { fetchUrlContent } from "@/lib/services/url-fetcher";
import { generateSourceSummaryWithAi } from "@/lib/ai/source-auto-summarizer";
import { summarizeSourcesWithAi } from "@/lib/ai/source-summarizer";
import { generateAiArticleDraft } from "@/lib/ai/article-writer";
import { saveDraftArticle, saveArticleMasterManuscript, approveArticle, getArticleById } from "@/lib/repositories/article-repository";
import { buildMasterManuscript } from "@/lib/articles/master-manuscript-builder";
import { evaluateArticleForMode } from "@/lib/ai/eval-article";
import { saveEvalRun } from "@/lib/repositories/eval-repository";
import { loadContract } from "@/lib/harness/load-contract";
import { runContractForCollection } from "@/lib/harness/contract-runner";
import { shouldUseAnthropic } from "@/lib/ai/ai-config";
import { generatePlatformPosts } from "@/lib/social/multi-platform-generation-service";
import { rerunSocialPostQualityGate } from "@/lib/social/social-post-service";
import { summarizeAutoReview, summarizeUserFacingReview } from "@/lib/social/social-post-auto-review";
import { getSocialPostById } from "@/lib/repositories/social-posts-repository";
import { approveAndPrepareWordPressBlogPostForPublishing } from "@/lib/social/wordpress-blog-publish-preparation-orchestrator";
import { runPlatformPublishingGuard } from "@/lib/social/platform-publishing-guard-service";
import type { SocialPostQualityChecklistItem } from "@/lib/social/social-platform-types";

const LABEL = "ops-04r1-article-c";
const TOPIC_TITLE = "국민연금 제도의 구조와 수령 방식";
const SOURCE_URLS = ["https://ko.wikipedia.org/wiki/국민연금", "https://ko.wikipedia.org/wiki/국민연금공단", "https://ko.wikipedia.org/wiki/연금"];

const timings: Record<string, number> = {};
function mark(label: string, startedAt: number): void {
  timings[label] = Date.now() - startedAt;
  console.log(`[${LABEL}] ${label}: ${timings[label]}ms`);
}

let themeId = "";
let articleId = "";
let socialPostId = "";

describe("OPS-04R1 Article C: 국민연금(한국어 source only) 실제 운영", () => {
  it("aiMode가 실제로 활성화되어 있다", () => {
    expect(shouldUseAnthropic()).toBe(true);
  });

  it("1) 테마 생성 + 출처 3건 등록(실제 fetch + AI 요약)", async () => {
    const t0 = Date.now();
    const theme = await createTheme({
      title: TOPIC_TITLE,
      description: "대한민국 국민연금 제도가 어떻게 운영되고 수령액이 어떻게 결정되는지 한국어 출처를 바탕으로 설명하는 블로그 글.",
      keywords: ["국민연금", "국민연금공단", "노후연금", "연금수령"],
      language: "ko",
    });
    themeId = theme.id;
    console.log(`[${LABEL}] themeId=${themeId}`);

    for (const url of SOURCE_URLS) {
      const source = await addSource({ themeId, url, title: "", publisher: "", publishedAt: "", summary: "" });
      const fetchResult = await fetchUrlContent(url);
      await updateSourceFetchResult(source.id, fetchResult, source.title);
      console.log(`[${LABEL}] source ${source.id} url=${url} fetch status=${fetchResult.status} contentLength=${fetchResult.rawContent?.length ?? 0}`);
      if (fetchResult.status === "success" && fetchResult.rawContent) {
        const summary = await generateSourceSummaryWithAi(source, fetchResult.rawContent);
        await updateSourceSummary(source.id, summary, "success");
      }
    }
    mark("1_theme_and_sources", t0);

    const sources = await getSourcesByThemeId(themeId);
    expect(sources.length).toBe(3);
  }, 120_000);

  it("2) 출처 계약 검사를 통과한다", async () => {
    const sources = await getSourcesByThemeId(themeId);
    const contract = loadContract("source.contract.yaml");
    const result = runContractForCollection(contract, sources as unknown as Record<string, unknown>[], {
      collections: { topic_sources: sources as unknown as Record<string, unknown>[] },
    });
    expect(result.passed).toBe(true);
  });

  it("3) AI 마스터 원고(source_based_explainer) 생성 + 저장 + 평가", async () => {
    const t0 = Date.now();
    const theme = await getThemeById(themeId);
    const sources = await getSourcesByThemeId(themeId);
    expect(theme).toBeDefined();

    const sourceSummaries = await summarizeSourcesWithAi(theme!, sources);
    const generated = await generateAiArticleDraft(theme!, sourceSummaries, "source_based_explainer");
    mark("3a_ai_generation", t0);
    console.log(`[${LABEL}] generated title="${generated.title}" contentLength=${generated.content.length} citedSourceIds=${generated.citedSourceIds.length}`);

    const citedSources = sources.filter((s) => generated.citedSourceIds.includes(s.id));
    const articleContract = loadContract("article.contract.yaml");
    const articleResult = runContractForCollection(
      articleContract,
      [{ title: generated.title, content: generated.content, topicId: themeId, status: "draft" }],
      { collections: { article_sources: citedSources as unknown as Record<string, unknown>[] }, operation: "create" }
    );
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
    console.log(`[${LABEL}] articleId=${articleId} status=${article.status}`);

    const masterManuscript = buildMasterManuscript(article, citedSources);
    await saveArticleMasterManuscript(article.id, masterManuscript);

    // OPS-04R1 섹션 4: upstream integrity 결과를 여기서 바로 기록한다(추가 재계산 없이 생성 시점 결과 그대로).
    console.log(
      `[${LABEL}] UPSTREAM_INTEGRITY verifiedFactsCount=${masterManuscript.verifiedFacts.length} rejectedFactsCount=${(masterManuscript.rejectedFacts ?? []).length} verificationNeededCount=${masterManuscript.verificationNeeded.length}`
    );
    const rejectedByStatus = (masterManuscript.rejectedFacts ?? []).reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    }, {});
    console.log(`[${LABEL}] UPSTREAM_INTEGRITY rejectedByStatus=${JSON.stringify(rejectedByStatus)}`);

    const citedSummaries = sourceSummaries.filter((s) => article.citedSourceIds.includes(s.sourceId));
    const t1 = Date.now();
    const evalResult = await evaluateArticleForMode("source_based_explainer", { title: article.title, content: article.content }, citedSummaries, true);
    mark("3b_eval", t1);
    await saveEvalRun({ articleId: article.id, evalName: "source-based-explainer.eval", result: evalResult });
    console.log(`[${LABEL}] eval passed=${evalResult.passed} aggregateScore=${evalResult.aggregateScore}`);
    mark("3_generation_total", t0);

    expect(article.status).toBe("draft");
  }, 180_000);

  it("4) 원본 기사(article) 승인", async () => {
    const t0 = Date.now();
    const article = await approveArticle({ articleId, approvedBy: LABEL });
    mark("4_article_approval", t0);
    expect(article.status).toBe("reviewed");
  });

  it("5) wordpress_blog social post 생성", async () => {
    const t0 = Date.now();
    const summary = await generatePlatformPosts({ articleId, platforms: ["wordpress_blog"], toneMode: "auto_recommended" });
    mark("5_social_generation", t0);
    console.log(`[${LABEL}] generation summary=${JSON.stringify(summary.results.map((r) => ({ platform: r.platform, status: r.status, tone: r.toneStyle })))}`);
    const outcome = summary.results.find((r) => r.platform === "wordpress_blog");
    expect(["generated", "skipped_existing"]).toContain(outcome?.status);
    if (outcome?.socialPostId) {
      socialPostId = outcome.socialPostId;
    } else {
      const { listSocialPostsByArticle } = await import("@/lib/repositories/social-posts-repository");
      const posts = await listSocialPostsByArticle(articleId);
      const existing = posts.find((p) => p.platform === "wordpress_blog");
      socialPostId = existing!.id;
    }
    console.log(`[${LABEL}] socialPostId=${socialPostId}`);
  }, 280_000);

  it("6) 자동 검토(quality gate, downstream Layer 2) 실행 + fact-grounding 관찰", async () => {
    const t0 = Date.now();
    const qualityResult = await rerunSocialPostQualityGate(socialPostId);
    mark("6a_quality_gate", t0);
    console.log(`[${LABEL}] quality gate success=${qualityResult.success} status=${qualityResult.socialPost?.qualityStatus}`);

    const post = qualityResult.socialPost!;
    const checklist = (post.qualitySummary as { checklist?: SocialPostQualityChecklistItem[] })?.checklist ?? [];
    const review = summarizeAutoReview(checklist);
    const userFacing = summarizeUserFacingReview(post.qualityStatus, review, checklist);
    const factGroundingItem = checklist.find((c) => c.key === "fact_grounding");
    console.log(
      `[${LABEL}] DOWNSTREAM_LAYER2 review counts=${JSON.stringify(review.counts)} confirmationCount=${userFacing.confirmationCount} fact_grounding=${factGroundingItem ? JSON.stringify(factGroundingItem) : "not_run"}`
    );
    expect(review.counts.blocked).toBe(0);
  }, 180_000);

  it("7) 승인 + WordPress 게시 준비 일괄 실행(실제 Draft 생성)", async () => {
    const t0 = Date.now();
    const result = await approveAndPrepareWordPressBlogPostForPublishing(articleId, socialPostId, LABEL);
    mark("7_approve_and_prepare", t0);
    console.log(`[${LABEL}] prepare result success=${result.success} partialSuccess=${result.partialSuccess}`);
    expect(result.success).toBe(true);
  }, 180_000);

  it("8) Publish guard 확인", async () => {
    const guardResult = await runPlatformPublishingGuard(socialPostId);
    console.log(`[${LABEL}] guard status=${guardResult.result?.status} score=${guardResult.result?.score}`);
    expect(guardResult.result?.status).not.toBe("blocked");
  });

  it("9) 최종 상태 요약 출력", async () => {
    const article = await getArticleById(articleId);
    const post = await getSocialPostById(socialPostId);
    console.log(`[${LABEL}] FINAL article.status=${article?.status}`);
    console.log(`[${LABEL}] FINAL post.qualityStatus=${post?.qualityStatus} approvalStatus=${post?.approvalStatus} guardStatus=${post?.platformPublishGuardStatus}`);
    console.log(`[${LABEL}] FINAL timings=${JSON.stringify(timings)}`);
    console.log(`[${LABEL}] FINAL ids: themeId=${themeId} articleId=${articleId} socialPostId=${socialPostId}`);
  });
});
