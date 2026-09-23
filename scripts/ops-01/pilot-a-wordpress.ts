// OPS-01 Pilot A: 실제 WordPress 블로그 설명형 콘텐츠 파일럿.
// 실제 Supabase DB / 실제 Anthropic API / 실제 WordPress 사이트(Draft만)를
// 사용한다. 공개 게시(public publish)는 어떤 단계에서도 호출하지 않는다.
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
import { summarizeAutoReview, getApprovalGateStatus } from "@/lib/social/social-post-auto-review";
import { getSocialPostById } from "@/lib/repositories/social-posts-repository";
import { approveAndPrepareWordPressBlogPostForPublishing } from "@/lib/social/wordpress-blog-publish-preparation-orchestrator";
import { runPlatformPublishingGuard } from "@/lib/social/platform-publishing-guard-service";
import type { SocialPostQualityChecklistItem } from "@/lib/social/social-platform-types";

const PILOT_LABEL = "ops-01-pilot-a";
const TOPIC_TITLE = "카페인이 우리 몸에 미치는 영향과 적정 섭취량";
const SOURCE_URLS = [
  "https://ko.wikipedia.org/wiki/카페인",
  "https://ko.wikipedia.org/wiki/커피",
  "https://en.wikipedia.org/wiki/Caffeine",
];

const timings: Record<string, number> = {};
function mark(label: string, startedAt: number): void {
  timings[label] = Date.now() - startedAt;
  console.log(`[ops-01-pilot-a] ${label}: ${timings[label]}ms`);
}

// 재실행 시 이미 만든 theme/article을 다시 만들지 않기 위한 resume 지원
// (AI 호출은 비용이 발생하므로, 이전 단계가 이미 성공했으면 재사용한다).
// 첫 실행에서 timeout으로 5단계부터 실패했을 때 이 값을 채워 재실행했다.
const RESUME_THEME_ID = process.env.OPS01_RESUME_THEME_ID ?? "";
const RESUME_ARTICLE_ID = process.env.OPS01_RESUME_ARTICLE_ID ?? "";

let themeId = RESUME_THEME_ID;
let articleId = RESUME_ARTICLE_ID;
let socialPostId = "";

describe("OPS-01 Pilot A: WordPress blog 파일럿(실제 실행)", () => {
  it("aiMode가 실제로 활성화되어 있다(mock으로 전환되지 않음)", () => {
    expect(shouldUseAnthropic()).toBe(true);
  });

  it.skipIf(RESUME_ARTICLE_ID)("1) 테마 생성 + 출처 3건 등록(실제 fetch + AI 요약)", async () => {
    const t0 = Date.now();
    const theme = await createTheme({
      title: TOPIC_TITLE,
      description: "카페인의 작용 원리, 인체에 미치는 영향, 하루 권장 섭취량을 실제 출처를 바탕으로 설명하는 일반 대상 블로그 글.",
      keywords: ["카페인", "커피", "적정 섭취량"],
      language: "ko",
    });
    themeId = theme.id;
    console.log(`[ops-01-pilot-a] themeId=${themeId}`);

    for (const url of SOURCE_URLS) {
      const source = await addSource({ themeId, url, title: "", publisher: "", publishedAt: "", summary: "" });
      const fetchResult = await fetchUrlContent(url);
      await updateSourceFetchResult(source.id, fetchResult, source.title);
      console.log(`[ops-01-pilot-a] source ${source.id} fetch status=${fetchResult.status} contentLength=${fetchResult.rawContent?.length ?? 0}`);
      if (fetchResult.status === "success" && fetchResult.rawContent) {
        const summary = await generateSourceSummaryWithAi(source, fetchResult.rawContent);
        await updateSourceSummary(source.id, summary, "success");
      }
    }
    mark("1_theme_and_sources", t0);

    const sources = await getSourcesByThemeId(themeId);
    expect(sources.length).toBe(3);
  }, 120_000);

  it.skipIf(RESUME_ARTICLE_ID)("2) 출처 계약 검사를 통과한다", async () => {
    const sources = await getSourcesByThemeId(themeId);
    const contract = loadContract("source.contract.yaml");
    const result = runContractForCollection(contract, sources as unknown as Record<string, unknown>[], {
      collections: { topic_sources: sources as unknown as Record<string, unknown>[] },
    });
    console.log(`[ops-01-pilot-a] source contract passed=${result.passed} violations=${result.violations.length}`);
    expect(result.passed).toBe(true);
  });

  it.skipIf(RESUME_ARTICLE_ID)("3) AI 마스터 원고(monetized_blog) 생성 + 저장 + 평가", async () => {
    const t0 = Date.now();
    const theme = await getThemeById(themeId);
    const sources = await getSourcesByThemeId(themeId);
    expect(theme).toBeDefined();

    const sourceSummaries = await summarizeSourcesWithAi(theme!, sources);
    const generated = await generateAiArticleDraft(theme!, sourceSummaries, "monetized_blog");
    mark("3a_ai_generation", t0);
    console.log(`[ops-01-pilot-a] generated title="${generated.title}" contentLength=${generated.content.length} citedSourceIds=${generated.citedSourceIds.length}`);

    const citedSources = sources.filter((s) => generated.citedSourceIds.includes(s.id));
    const articleContract = loadContract("article.contract.yaml");
    const articleResult = runContractForCollection(
      articleContract,
      [{ title: generated.title, content: generated.content, topicId: themeId, status: "draft" }],
      { collections: { article_sources: citedSources as unknown as Record<string, unknown>[] }, operation: "create" }
    );
    console.log(`[ops-01-pilot-a] article contract passed=${articleResult.passed} violations=${articleResult.violations.length}`);
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
    console.log(`[ops-01-pilot-a] articleId=${articleId} status=${article.status}`);

    const masterManuscript = buildMasterManuscript(article, citedSources);
    await saveArticleMasterManuscript(article.id, masterManuscript);

    const citedSummaries = sourceSummaries.filter((s) => article.citedSourceIds.includes(s.sourceId));
    const t1 = Date.now();
    const evalResult = await evaluateArticleForMode("monetized_blog", { title: article.title, content: article.content }, citedSummaries, true);
    mark("3b_eval", t1);
    await saveEvalRun({ articleId: article.id, evalName: "monetized-blog.eval", result: evalResult });
    console.log(`[ops-01-pilot-a] eval passed=${evalResult.passed} aggregateScore=${evalResult.aggregateScore}`);
    mark("3_generation_total", t0);

    expect(article.status).toBe("draft");
  }, 180_000);

  it.skipIf(RESUME_ARTICLE_ID)("4) 원본 기사(article) 승인", async () => {
    const t0 = Date.now();
    const article = await approveArticle({ articleId, approvedBy: PILOT_LABEL });
    mark("4_article_approval", t0);
    console.log(`[ops-01-pilot-a] article approved status=${article.status}`);
    expect(article.status).toBe("reviewed");
  });

  it("4b) resume 시 기존 article이 이미 승인되어 있는지 확인", async () => {
    if (!RESUME_ARTICLE_ID) return;
    const article = await getArticleById(articleId);
    console.log(`[ops-01-pilot-a] resumed articleId=${articleId} status=${article?.status}`);
    expect(article?.status).toBe("reviewed");
  });

  it("5) wordpress_blog social post 생성", async () => {
    const t0 = Date.now();
    const summary = await generatePlatformPosts({ articleId, platforms: ["wordpress_blog"], toneMode: "auto_recommended" });
    mark("5_social_generation", t0);
    console.log(`[ops-01-pilot-a] generation summary=${JSON.stringify(summary.results.map((r) => ({ platform: r.platform, status: r.status })))}`);
    const outcome = summary.results.find((r) => r.platform === "wordpress_blog");
    expect(["generated", "skipped_existing"]).toContain(outcome?.status);
    if (outcome?.socialPostId) {
      socialPostId = outcome.socialPostId;
    } else {
      // skipped_existing이면 목록에서 실제 id를 찾는다.
      const { listSocialPostsByArticle } = await import("@/lib/repositories/social-posts-repository");
      const posts = await listSocialPostsByArticle(articleId);
      const existing = posts.find((p) => p.platform === "wordpress_blog");
      socialPostId = existing!.id;
    }
    console.log(`[ops-01-pilot-a] socialPostId=${socialPostId}`);
  }, 280_000);

  it("6) 자동 검토(quality gate) 실행 + 필요 시 자동 수정", async () => {
    const t0 = Date.now();
    const qualityResult = await rerunSocialPostQualityGate(socialPostId);
    mark("6a_quality_gate", t0);
    console.log(`[ops-01-pilot-a] quality gate success=${qualityResult.success} status=${qualityResult.socialPost?.qualityStatus}`);

    let post = qualityResult.socialPost!;
    const checklist = (post.qualitySummary as { checklist?: SocialPostQualityChecklistItem[] })?.checklist ?? [];
    const review = summarizeAutoReview(checklist);
    console.log(
      `[ops-01-pilot-a] review counts=${JSON.stringify(review.counts)} riskLevel=${review.riskLevel}`
    );

    if (post.qualityStatus === "needs_revision") {
      const t1 = Date.now();
      const autoFix = await runAutoFixAndRecheck(socialPostId);
      mark("6b_auto_fix", t1);
      console.log(`[ops-01-pilot-a] auto_fix success=${autoFix.success} finalState=${autoFix.finalState} changes=${JSON.stringify(autoFix.changesApplied)}`);
      post = (await getSocialPostById(socialPostId))!;
    }

    const gate = getApprovalGateStatus({
      qualityStatus: post.qualityStatus,
      approvalStatus: post.approvalStatus,
      publishStatus: post.publishStatus,
      hasContent: Boolean(post.postBody?.trim()),
      hasBlockingIssues: review.counts.blocked > 0,
    });
    console.log(`[ops-01-pilot-a] canApprove=${gate.canApprove} reason=${gate.reason}`);
    expect(gate.canApprove).toBe(true);
  }, 180_000);

  it("7) 승인 + WordPress 게시 준비 일괄 실행(실제 Draft 생성)", async () => {
    const t0 = Date.now();
    const result = await approveAndPrepareWordPressBlogPostForPublishing(articleId, socialPostId, PILOT_LABEL);
    mark("7_approve_and_prepare", t0);
    console.log(`[ops-01-pilot-a] prepare result success=${result.success} partialSuccess=${result.partialSuccess}`);
    console.log(`[ops-01-pilot-a] steps=${JSON.stringify(result.steps)}`);
    expect(result.success).toBe(true);
  }, 180_000);

  it("8) QA-01-FIX1 회귀 확인: manual export 미실행이어도 guard가 차단하지 않는다", async () => {
    const guardResult = await runPlatformPublishingGuard(socialPostId);
    console.log(`[ops-01-pilot-a] guard status=${guardResult.result?.status} score=${guardResult.result?.score} blockedReasons=${JSON.stringify(guardResult.result?.blockedReasons)}`);
    expect(guardResult.result?.status).not.toBe("blocked");

    const post = await getSocialPostById(socialPostId);
    console.log(`[ops-01-pilot-a] exportStatus(참고, wordpress_blog는 사용 안 함)=${post?.exportStatus}`);
  });

  it("9) 최종 상태 요약 출력(Draft 결과 확인)", async () => {
    const article = await getArticleById(articleId);
    const post = await getSocialPostById(socialPostId);
    console.log(`[ops-01-pilot-a] FINAL article.status=${article?.status} wpMetadataStatus=${article?.wpMetadataStatus} seoPluginMetadataStatus=${article?.seoPluginMetadataStatus}`);
    console.log(`[ops-01-pilot-a] FINAL post.qualityStatus=${post?.qualityStatus} approvalStatus=${post?.approvalStatus} guardStatus=${post?.platformPublishGuardStatus}`);
    console.log(`[ops-01-pilot-a] FINAL timings=${JSON.stringify(timings)}`);
    expect(post?.approvalStatus).toBe("approved");
  });
});
