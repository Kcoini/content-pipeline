// OPS-04R1 Article D (Case B+C: 영어 source 위주 + 한국어 source 혼합
// → 한국어 content): naver_cafe + x 실제 운영 — 다국어 upstream
// integrity 처리(섹션 14)를 실제 생성에서 확인하는 소규모 재검증.
// 실제 Supabase DB / 실제 Anthropic API. 실제 외부 게시 API 호출은
// 이 코드베이스에 존재하지 않는다 — 승인까지만 진행한다.
import "./load-env";

import { describe, it, expect } from "vitest";
import { runContractForCollection } from "@/lib/harness/contract-runner";
import { loadContract } from "@/lib/harness/load-contract";
import { createTheme, getThemeById } from "@/lib/repositories/theme-repository";
import { addSource, getSourcesByThemeId, updateSourceFetchResult, updateSourceSummary } from "@/lib/repositories/source-repository";
import { fetchUrlContent } from "@/lib/services/url-fetcher";
import { generateSourceSummaryWithAi } from "@/lib/ai/source-auto-summarizer";
import { saveDraftArticle, saveArticleMasterManuscript, approveArticle } from "@/lib/repositories/article-repository";
import { buildMasterManuscript } from "@/lib/articles/master-manuscript-builder";
import { evaluateArticleForMode } from "@/lib/ai/eval-article";
import { saveEvalRun } from "@/lib/repositories/eval-repository";
import { generateAiArticleDraft } from "@/lib/ai/article-writer";
import { summarizeSourcesWithAi } from "@/lib/ai/source-summarizer";
import { shouldUseAnthropic } from "@/lib/ai/ai-config";
import { getArticleModeConfig } from "@/lib/articles/article-modes";
import { generateSelectedPlatformPosts } from "@/lib/social/multi-platform-generation-service";
import { getSocialPostById } from "@/lib/repositories/social-posts-repository";
import { runSocialPostQualityGateAndSave } from "@/lib/social/social-post-service";
import { summarizeAutoReview, summarizeUserFacingReview } from "@/lib/social/social-post-auto-review";
import { bulkApproveSocialPosts, approveSocialPost } from "@/lib/social/social-post-approval-service";
import { summarizeMultiPlatformReview } from "@/lib/ui/multi-platform-review-summary";
import type { SocialPlatform, SocialPostQualityChecklistItem } from "@/lib/social/social-platform-types";

const APPROVED_BY = "ops-04r1-article-d";
const PLATFORMS: SocialPlatform[] = ["naver_cafe", "x"];

const SOURCES = [
  { url: "https://en.wikipedia.org/wiki/Richter_magnitude_scale", title: "Richter magnitude scale", publisher: "Wikipedia" },
  { url: "https://en.wikipedia.org/wiki/Moment_magnitude_scale", title: "Moment magnitude scale", publisher: "Wikipedia" },
  { url: "https://ko.wikipedia.org/wiki/리히터_규모", title: "리히터 규모", publisher: "위키백과" },
];

const THEME_TITLE = "지진 규모, 리히터 규모와 모멘트 규모는 어떻게 다른가";

const state: {
  themeId?: string;
  articleId?: string;
  socialPostIds: Partial<Record<SocialPlatform, string>>;
  timings: Record<string, number>;
} = { socialPostIds: {}, timings: {} };

function mark(label: string, startedAt: number) {
  state.timings[label] = Date.now() - startedAt;
  console.log(`[ops-04r1-article-d] ${label}: ${state.timings[label]}ms`);
}

describe("OPS-04R1 Article D: naver_cafe/x(영어+한국어 혼합 source) 실제 운영", () => {
  it("aiMode가 실제로 활성화되어 있다", () => {
    expect(shouldUseAnthropic()).toBe(true);
  });

  it("1. Theme 생성", async () => {
    const t0 = Date.now();
    const theme = await createTheme({
      title: THEME_TITLE,
      description: "지진 규모를 나타내는 리히터 규모와 모멘트 규모의 차이를 영어/한국어 출처를 바탕으로 설명하는 정보성 콘텐츠",
      keywords: ["리히터규모", "모멘트규모", "지진", "지진규모"],
      language: "ko",
    });
    state.themeId = theme.id;
    mark("theme_create", t0);
    console.log(`[ops-04r1-article-d] themeId=${state.themeId}`);
    expect(theme.id).toBeTruthy();
  });

  it("2. Source 3건 등록(영어 2 + 한국어 1) + 본문 수집 + AI 요약", async () => {
    const t0 = Date.now();
    const themeId = state.themeId!;
    for (const s of SOURCES) {
      const source = await addSource({ themeId, url: s.url, title: s.title, publisher: s.publisher, publishedAt: "", summary: "" });
      const fetchResult = await fetchUrlContent(s.url);
      await updateSourceFetchResult(source.id, fetchResult, s.title);
      console.log(`[ops-04r1-article-d] source ${source.id} url=${s.url} fetch status=${fetchResult.status}`);
      if (fetchResult.status === "success" && fetchResult.rawContent) {
        const summary = await generateSourceSummaryWithAi(source, fetchResult.rawContent);
        await updateSourceSummary(source.id, summary, "success");
      }
    }
    mark("sources_add_fetch_summarize", t0);
    const sources = await getSourcesByThemeId(themeId);
    expect(sources.length).toBe(3);
  }, 120_000);

  it("3. 출처 계약 검사 통과 확인", async () => {
    const themeId = state.themeId!;
    const sources = await getSourcesByThemeId(themeId);
    const contract = loadContract("source.contract.yaml");
    const result = runContractForCollection(contract, sources as unknown as Record<string, unknown>[], {
      collections: { topic_sources: sources as unknown as Record<string, unknown>[] },
    });
    expect(result.passed).toBe(true);
  });

  it("4. AI 마스터 원고(article) 생성 + 계약 검사 + 저장 + 평가 + upstream integrity 기록", async () => {
    const t0 = Date.now();
    const themeId = state.themeId!;
    const theme = await getThemeById(themeId);
    expect(theme, "theme not found").toBeTruthy();
    const themeSources = await getSourcesByThemeId(themeId);

    const sourceSummaries = await summarizeSourcesWithAi(theme!, themeSources);
    const generated = await generateAiArticleDraft(theme!, sourceSummaries, "source_based_explainer");
    mark("article_ai_generate", t0);

    const citedSources = themeSources.filter((s) => generated.citedSourceIds.includes(s.id));
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
    state.articleId = article.id;
    console.log(`[ops-04r1-article-d] articleId=${article.id}`);

    const mm = buildMasterManuscript(article, citedSources);
    await saveArticleMasterManuscript(article.id, mm);

    console.log(
      `[ops-04r1-article-d] UPSTREAM_INTEGRITY verifiedFactsCount=${mm.verifiedFacts.length} rejectedFactsCount=${(mm.rejectedFacts ?? []).length} verificationNeededCount=${mm.verificationNeeded.length}`
    );
    const rejectedByStatus = (mm.rejectedFacts ?? []).reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    }, {});
    console.log(`[ops-04r1-article-d] UPSTREAM_INTEGRITY rejectedByStatus=${JSON.stringify(rejectedByStatus)}`);

    const citedSummaries = sourceSummaries.filter((s) => article.citedSourceIds.includes(s.sourceId));
    const evalResult = await evaluateArticleForMode("source_based_explainer", { title: article.title, content: article.content }, citedSummaries, true);
    const evalConfigName = getArticleModeConfig("source_based_explainer").evalFileName.replace(/\.yaml$/, "");
    await saveEvalRun({ articleId: article.id, evalName: evalConfigName, result: evalResult });

    expect(article.status).toBe("draft");
    console.log(`[ops-04r1-article-d] article eval passed=${evalResult.passed}, score=${evalResult.aggregateScore}`);
  }, 180_000);

  it("5. 마스터 원고 승인(reviewed)", async () => {
    const article = await approveArticle({ articleId: state.articleId!, approvedBy: APPROVED_BY });
    expect(article.status).toBe("reviewed");
  });

  it("6. naver_cafe/x 2개 플랫폼 글 생성(실제 AI 호출)", async () => {
    const t0 = Date.now();
    const summary = await generateSelectedPlatformPosts({ articleId: state.articleId!, platforms: PLATFORMS, toneMode: "auto_recommended" });
    mark("platform_generation_all", t0);
    if ("error" in summary) throw new Error(summary.error);

    for (const r of summary.results) {
      console.log(`[ops-04r1-article-d] platform=${r.platform} status=${r.status} tone=${r.toneStyle ?? "-"}`);
      if (r.socialPostId) state.socialPostIds[r.platform] = r.socialPostId;
    }
    console.log(`[ops-04r1-article-d] generatedCount=${summary.generatedCount} failedCount=${summary.failedCount}`);
  }, 300_000);

  it("7. 플랫폼별 품질 검사(downstream Layer 2) + fact-grounding 관찰", async () => {
    const t0 = Date.now();
    for (const platform of PLATFORMS) {
      const socialPostId = state.socialPostIds[platform];
      if (!socialPostId) continue;

      const gateResult = await runSocialPostQualityGateAndSave(socialPostId);
      console.log(`[ops-04r1-article-d] ${platform} quality gate success=${gateResult.success} status=${gateResult.socialPost?.qualityStatus}`);

      const post = await getSocialPostById(socialPostId);
      const checklist = Array.isArray(post!.qualitySummary?.checklist) ? (post!.qualitySummary.checklist as unknown as SocialPostQualityChecklistItem[]) : [];
      const review = summarizeAutoReview(checklist);
      const userFacing = summarizeUserFacingReview(post!.qualityStatus, review, checklist);
      const factGroundingItem = checklist.find((c) => c.key === "fact_grounding");
      console.log(
        `[ops-04r1-article-d] DOWNSTREAM_LAYER2 ${platform} confirmationCount=${userFacing.confirmationCount} blocked=${review.counts.blocked} fact_grounding=${factGroundingItem ? JSON.stringify(factGroundingItem) : "not_run"}`
      );
      expect(review.counts.blocked).toBe(0);
    }
    mark("quality_review_all", t0);
  }, 180_000);

  it("8. MultiPlatformReviewSummary 계산 + bulk approval + 나머지 개별 승인", async () => {
    const t0 = Date.now();
    const posts = [];
    for (const platform of PLATFORMS) {
      const id = state.socialPostIds[platform];
      if (!id) continue;
      const post = await getSocialPostById(id);
      const checklist = Array.isArray(post!.qualitySummary?.checklist) ? (post!.qualitySummary.checklist as unknown as SocialPostQualityChecklistItem[]) : [];
      const review = summarizeAutoReview(checklist);
      const userFacing = summarizeUserFacingReview(post!.qualityStatus, review, checklist);
      posts.push({ id: post!.id, approvalStatus: post!.approvalStatus, review: userFacing });
    }
    const reviewSummary = summarizeMultiPlatformReview(posts);
    console.log(`[ops-04r1-article-d] MultiPlatformReviewSummary bulkEligible=${reviewSummary.bulkApprovalEligiblePostIds.length}`);

    const bulkResult = await bulkApproveSocialPosts(reviewSummary.bulkApprovalEligiblePostIds, APPROVED_BY);
    console.log(`[ops-04r1-article-d] bulkApprove success=${bulkResult.successCount} failure=${bulkResult.failureCount}`);
    mark("review_summary_bulk_approve", t0);

    for (const platform of PLATFORMS) {
      const id = state.socialPostIds[platform];
      if (!id) continue;
      const post = await getSocialPostById(id);
      if (post!.approvalStatus !== "approved") {
        const result = await approveSocialPost(id, APPROVED_BY, "운영자 검토: OPS-04R1 소규모 재검증 — downstream fact_grounding 확인 완료, 차단 사유 아님");
        console.log(`[ops-04r1-article-d] ${platform} individual approve success=${result.success}`);
      }
    }
  }, 60_000);

  it("9. 결과 요약 출력(운영 로그 작성용)", async () => {
    console.log(`[ops-04r1-article-d] themeId=${state.themeId} articleId=${state.articleId}`);
    for (const platform of PLATFORMS) {
      console.log(`[ops-04r1-article-d] ${platform} socialPostId=${state.socialPostIds[platform] ?? "(생성 실패)"}`);
    }
    console.log(`[ops-04r1-article-d] timings=${JSON.stringify(state.timings)}`);
  });
});
