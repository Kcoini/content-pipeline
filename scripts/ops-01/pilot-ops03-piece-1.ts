// OPS-03 Piece 1: 실제 WordPress 블로그 설명형 콘텐츠(제한 운영).
// 실제 Supabase DB / 실제 Anthropic API / 실제 WordPress 사이트(Draft만).
// 공개 게시는 어떤 단계에서도 호출하지 않는다.
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
import { runAutoFixAndRecheck } from "@/lib/social/post-auto-fix-service";
import { summarizeAutoReview, summarizeUserFacingReview, getApprovalGateStatus } from "@/lib/social/social-post-auto-review";
import { getSocialPostById } from "@/lib/repositories/social-posts-repository";
import { approveAndPrepareWordPressBlogPostForPublishing } from "@/lib/social/wordpress-blog-publish-preparation-orchestrator";
import { runPlatformPublishingGuard } from "@/lib/social/platform-publishing-guard-service";
import type { SocialPostQualityChecklistItem } from "@/lib/social/social-platform-types";

const PILOT_LABEL = "ops-03-piece-1";
const TOPIC_TITLE = "수면의 질을 높이는 방법과 올바른 수면 습관";
const SOURCE_URLS = [
  "https://ko.wikipedia.org/wiki/수면",
  "https://ko.wikipedia.org/wiki/불면증",
  "https://en.wikipedia.org/wiki/Sleep_hygiene",
];

const timings: Record<string, number> = {};
function mark(label: string, startedAt: number): void {
  timings[label] = Date.now() - startedAt;
  console.log(`[ops-03-piece-1] ${label}: ${timings[label]}ms`);
}

let themeId = "";
let articleId = "";
let socialPostId = "";

describe("OPS-03 Piece 1: WordPress blog(수면 위생) 실제 운영", () => {
  it("aiMode가 실제로 활성화되어 있다", () => {
    expect(shouldUseAnthropic()).toBe(true);
  });

  it("1) 테마 생성 + 출처 3건 등록(실제 fetch + AI 요약)", async () => {
    const t0 = Date.now();
    const theme = await createTheme({
      title: TOPIC_TITLE,
      description: "수면의 생리학적 원리와 불면증의 원인, 실제로 도움이 되는 수면 위생 수칙을 출처 기반으로 설명하는 블로그 글.",
      keywords: ["수면", "수면의 질", "불면증", "수면 위생"],
      language: "ko",
    });
    themeId = theme.id;
    console.log(`[ops-03-piece-1] themeId=${themeId}`);

    for (const url of SOURCE_URLS) {
      const source = await addSource({ themeId, url, title: "", publisher: "", publishedAt: "", summary: "" });
      const fetchResult = await fetchUrlContent(url);
      await updateSourceFetchResult(source.id, fetchResult, source.title);
      console.log(`[ops-03-piece-1] source ${source.id} fetch status=${fetchResult.status} contentLength=${fetchResult.rawContent?.length ?? 0}`);
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
    console.log(`[ops-03-piece-1] source contract passed=${result.passed} violations=${result.violations.length}`);
    expect(result.passed).toBe(true);
  });

  it("3) AI 마스터 원고(monetized_blog) 생성 + 저장 + 평가", async () => {
    const t0 = Date.now();
    const theme = await getThemeById(themeId);
    const sources = await getSourcesByThemeId(themeId);
    expect(theme).toBeDefined();

    const sourceSummaries = await summarizeSourcesWithAi(theme!, sources);
    const generated = await generateAiArticleDraft(theme!, sourceSummaries, "monetized_blog");
    mark("3a_ai_generation", t0);
    console.log(`[ops-03-piece-1] generated title="${generated.title}" contentLength=${generated.content.length} citedSourceIds=${generated.citedSourceIds.length}`);

    const citedSources = sources.filter((s) => generated.citedSourceIds.includes(s.id));
    const articleContract = loadContract("article.contract.yaml");
    const articleResult = runContractForCollection(
      articleContract,
      [{ title: generated.title, content: generated.content, topicId: themeId, status: "draft" }],
      { collections: { article_sources: citedSources as unknown as Record<string, unknown>[] }, operation: "create" }
    );
    console.log(`[ops-03-piece-1] article contract passed=${articleResult.passed} violations=${articleResult.violations.length}`);
    expect(articleResult.passed).toBe(true);

    const article = await saveDraftArticle({
      themeId,
      title: generated.title,
      content: generated.content,
      citedSourceIds: generated.citedSourceIds,
      articleMode: "monetized_blog",
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
    console.log(`[ops-03-piece-1] articleId=${articleId} status=${article.status}`);

    const masterManuscript = buildMasterManuscript(article, citedSources);
    await saveArticleMasterManuscript(article.id, masterManuscript);

    const citedSummaries = sourceSummaries.filter((s) => article.citedSourceIds.includes(s.sourceId));
    const t1 = Date.now();
    const evalResult = await evaluateArticleForMode("monetized_blog", { title: article.title, content: article.content }, citedSummaries, true);
    mark("3b_eval", t1);
    await saveEvalRun({ articleId: article.id, evalName: "monetized-blog.eval", result: evalResult });
    console.log(`[ops-03-piece-1] eval passed=${evalResult.passed} aggregateScore=${evalResult.aggregateScore}`);
    mark("3_generation_total", t0);

    expect(article.status).toBe("draft");
  }, 180_000);

  it("4) 원본 기사(article) 승인", async () => {
    const t0 = Date.now();
    const article = await approveArticle({ articleId, approvedBy: PILOT_LABEL });
    mark("4_article_approval", t0);
    console.log(`[ops-03-piece-1] article approved status=${article.status}`);
    expect(article.status).toBe("reviewed");
  });

  it("5) wordpress_blog social post 생성", async () => {
    const t0 = Date.now();
    const summary = await generatePlatformPosts({ articleId, platforms: ["wordpress_blog"], toneMode: "auto_recommended" });
    mark("5_social_generation", t0);
    console.log(`[ops-03-piece-1] generation summary=${JSON.stringify(summary.results.map((r) => ({ platform: r.platform, status: r.status })))}`);
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
    console.log(`[ops-03-piece-1] socialPostId=${socialPostId}`);
  }, 280_000);

  it("6) 자동 검토(quality gate) 실행 + 필요 시 자동 수정 + fact-grounding 관찰", async () => {
    const t0 = Date.now();
    const qualityResult = await rerunSocialPostQualityGate(socialPostId);
    mark("6a_quality_gate", t0);
    console.log(`[ops-03-piece-1] quality gate success=${qualityResult.success} status=${qualityResult.socialPost?.qualityStatus}`);

    let post = qualityResult.socialPost!;
    const checklist = (post.qualitySummary as { checklist?: SocialPostQualityChecklistItem[] })?.checklist ?? [];
    const review = summarizeAutoReview(checklist);
    const userFacing = summarizeUserFacingReview(post.qualityStatus, review, checklist);
    const factGroundingItem = checklist.find((c) => c.key === "fact_grounding");
    console.log(
      `[ops-03-piece-1] review counts=${JSON.stringify(review.counts)} riskLevel=${review.riskLevel} confirmationCount=${userFacing.confirmationCount} fact_grounding=${factGroundingItem ? factGroundingItem.status : "not_run(no evidenceText)"}`
    );

    let autoFixTriggered = false;
    if (post.qualityStatus === "needs_revision") {
      autoFixTriggered = true;
      const t1 = Date.now();
      const autoFix = await runAutoFixAndRecheck(socialPostId);
      mark("6b_auto_fix", t1);
      console.log(`[ops-03-piece-1] auto_fix success=${autoFix.success} finalState=${autoFix.finalState} changes=${JSON.stringify(autoFix.changesApplied)}`);
      post = (await getSocialPostById(socialPostId))!;
    }
    console.log(`[ops-03-piece-1] autoFixTriggered=${autoFixTriggered}`);

    const gate = getApprovalGateStatus({
      qualityStatus: post.qualityStatus,
      approvalStatus: post.approvalStatus,
      publishStatus: post.publishStatus,
      hasContent: Boolean(post.postBody?.trim()),
      hasBlockingIssues: review.counts.blocked > 0,
    });
    console.log(`[ops-03-piece-1] canApprove=${gate.canApprove} reason=${gate.reason}`);
    expect(gate.canApprove).toBe(true);
  }, 180_000);

  it("7) 승인 + WordPress 게시 준비 일괄 실행(실제 Draft 생성)", async () => {
    const t0 = Date.now();
    const result = await approveAndPrepareWordPressBlogPostForPublishing(articleId, socialPostId, PILOT_LABEL);
    mark("7_approve_and_prepare", t0);
    console.log(`[ops-03-piece-1] prepare result success=${result.success} partialSuccess=${result.partialSuccess}`);
    console.log(`[ops-03-piece-1] steps=${JSON.stringify(result.steps)}`);
    expect(result.success).toBe(true);
  }, 180_000);

  it("8) Publish guard 확인(회귀 없음 재확인)", async () => {
    const guardResult = await runPlatformPublishingGuard(socialPostId);
    console.log(`[ops-03-piece-1] guard status=${guardResult.result?.status} score=${guardResult.result?.score} blockedReasons=${JSON.stringify(guardResult.result?.blockedReasons)}`);
    expect(guardResult.result?.status).not.toBe("blocked");
  });

  it("9) 최종 상태 요약 출력(운영 로그 작성용)", async () => {
    const article = await getArticleById(articleId);
    const post = await getSocialPostById(socialPostId);
    console.log(`[ops-03-piece-1] FINAL article.status=${article?.status} wpMetadataStatus=${article?.wpMetadataStatus} seoPluginMetadataStatus=${article?.seoPluginMetadataStatus}`);
    console.log(`[ops-03-piece-1] FINAL post.qualityStatus=${post?.qualityStatus} approvalStatus=${post?.approvalStatus} guardStatus=${post?.platformPublishGuardStatus}`);
    console.log(`[ops-03-piece-1] FINAL timings=${JSON.stringify(timings)}`);
    console.log(`[ops-03-piece-1] FINAL ids: themeId=${themeId} articleId=${articleId} socialPostId=${socialPostId}`);
    expect(post?.approvalStatus).toBe("approved");
  });
});
