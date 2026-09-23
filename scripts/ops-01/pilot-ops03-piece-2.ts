// OPS-03 Piece 2: naver_cafe(manual/copy) + x/threads/instagram(copy) 다중
// 플랫폼 실제 운영(제한 운영). 실제 Supabase DB / 실제 Anthropic API.
// 실제 외부 SNS/Naver 게시 API 호출은 이 코드베이스에 존재하지 않는다
// (OPS-02B platform-capability-matrix.md에서 이미 확인됨) — copy 직전
// 상태(승인 완료)까지만 진행하고, "게시 완료로 표시"는 호출하지 않는다.
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
import { runAutoFixAndRecheck } from "@/lib/social/post-auto-fix-service";
import { bulkApproveSocialPosts } from "@/lib/social/social-post-approval-service";
import { summarizeMultiPlatformReview } from "@/lib/ui/multi-platform-review-summary";
import { getPostApprovalNextActions } from "@/lib/social/post-approval-next-actions";
import type { SocialPlatform, SocialPostQualityChecklistItem } from "@/lib/social/social-platform-types";

const APPROVED_BY = "ops-03-piece-2";
const PLATFORMS: SocialPlatform[] = ["naver_cafe", "x", "threads", "instagram"];

const SOURCES = [
  { url: "https://ko.wikipedia.org/wiki/준비운동", title: "준비운동", publisher: "위키백과" },
  { url: "https://ko.wikipedia.org/wiki/스트레칭", title: "스트레칭", publisher: "위키백과" },
  { url: "https://en.wikipedia.org/wiki/Warming_up", title: "Warming up", publisher: "Wikipedia" },
];

const THEME_TITLE = "홈트레이닝 초보자를 위한 준비 운동과 부상 예방";

const state: {
  themeId?: string;
  articleId?: string;
  socialPostIds: Partial<Record<SocialPlatform, string>>;
  timings: Record<string, number>;
} = { socialPostIds: {}, timings: {} };

function mark(label: string, startedAt: number) {
  state.timings[label] = Date.now() - startedAt;
  console.log(`[ops-03-piece-2] ${label}: ${state.timings[label]}ms`);
}

describe("OPS-03 Piece 2: naver_cafe/x/threads/instagram 실제 운영", () => {
  it("aiMode가 실제로 활성화되어 있다", () => {
    expect(shouldUseAnthropic()).toBe(true);
  });

  it("1. Theme 생성", async () => {
    const t0 = Date.now();
    const theme = await createTheme({
      title: THEME_TITLE,
      description: "홈트레이닝을 시작하는 초보자가 부상 없이 운동하기 위한 준비운동/스트레칭 방법을 출처 기반으로 설명하는 정보성 콘텐츠",
      keywords: ["홈트레이닝", "준비운동", "스트레칭", "부상 예방"],
      language: "ko",
    });
    state.themeId = theme.id;
    mark("theme_create", t0);
    console.log(`[ops-03-piece-2] themeId=${state.themeId}`);
    expect(theme.id).toBeTruthy();
  });

  it("2. Source 3건 등록 + 본문 수집 + AI 요약", async () => {
    const t0 = Date.now();
    const themeId = state.themeId!;
    for (const s of SOURCES) {
      const source = await addSource({ themeId, url: s.url, title: s.title, publisher: s.publisher, publishedAt: "", summary: "" });
      const fetchResult = await fetchUrlContent(s.url);
      await updateSourceFetchResult(source.id, fetchResult, s.title);
      if (fetchResult.status === "success" && fetchResult.rawContent) {
        const summary = await generateSourceSummaryWithAi(source, fetchResult.rawContent);
        await updateSourceSummary(source.id, summary, "success");
      } else {
        console.log(`[ops-03-piece-2] source fetch failed: ${s.url} (${fetchResult.status})`);
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

  it("4. AI 마스터 원고(article) 생성 + 계약 검사 + 저장 + 평가", async () => {
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
    console.log(`[ops-03-piece-2] articleId=${article.id}`);

    try {
      const mm = buildMasterManuscript(article, citedSources);
      await saveArticleMasterManuscript(article.id, mm);
    } catch (e) {
      console.log(`[ops-03-piece-2] master manuscript 저장 실패(부가 데이터, 무시): ${e instanceof Error ? e.message : e}`);
    }

    const citedSummaries = sourceSummaries.filter((s) => article.citedSourceIds.includes(s.sourceId));
    const evalResult = await evaluateArticleForMode(
      "source_based_explainer",
      { title: article.title, content: article.content },
      citedSummaries,
      true
    );
    const evalConfigName = getArticleModeConfig("source_based_explainer").evalFileName.replace(/\.yaml$/, "");
    await saveEvalRun({ articleId: article.id, evalName: evalConfigName, result: evalResult });

    expect(article.status).toBe("draft");
    console.log(`[ops-03-piece-2] article eval passed=${evalResult.passed}, score=${evalResult.aggregateScore}`);
  }, 180_000);

  it("5. 마스터 원고 승인(reviewed)", async () => {
    const article = await approveArticle({ articleId: state.articleId!, approvedBy: APPROVED_BY });
    expect(article.status).toBe("reviewed");
  });

  it("6. naver_cafe/x/threads/instagram 4개 플랫폼 글 생성(실제 AI 호출)", async () => {
    const t0 = Date.now();
    const summary = await generateSelectedPlatformPosts({
      articleId: state.articleId!,
      platforms: PLATFORMS,
      toneMode: "auto_recommended",
    });
    mark("platform_generation_all", t0);
    if ("error" in summary) throw new Error(summary.error);

    for (const r of summary.results) {
      console.log(`[ops-03-piece-2] platform=${r.platform} status=${r.status} tone=${r.toneStyle ?? "-"}`);
      if (r.socialPostId) state.socialPostIds[r.platform] = r.socialPostId;
    }
    console.log(`[ops-03-piece-2] generatedCount=${summary.generatedCount} failedCount=${summary.failedCount}`);
  }, 280_000);

  it("7. 플랫폼별 품질 검사 + 자동 검토 + 자동 수정 + fact-grounding 관찰", async () => {
    const t0 = Date.now();
    for (const platform of PLATFORMS) {
      const socialPostId = state.socialPostIds[platform];
      if (!socialPostId) {
        console.log(`[ops-03-piece-2] ${platform} 생성 실패 — 검토 단계 건너뜀`);
        continue;
      }

      const gateResult = await runSocialPostQualityGateAndSave(socialPostId);
      console.log(`[ops-03-piece-2] ${platform} quality gate success=${gateResult.success} status=${gateResult.socialPost?.qualityStatus}`);

      const post = await getSocialPostById(socialPostId);
      expect(post).toBeTruthy();
      const checklist = Array.isArray(post!.qualitySummary?.checklist)
        ? (post!.qualitySummary.checklist as unknown as SocialPostQualityChecklistItem[])
        : [];
      const review = summarizeAutoReview(checklist);
      const userFacing = summarizeUserFacingReview(post!.qualityStatus, review, checklist);
      const factGroundingItem = checklist.find((c) => c.key === "fact_grounding");
      console.log(
        `[ops-03-piece-2] ${platform} review state=${userFacing.state} confirmationCount=${userFacing.confirmationCount} blocked=${review.counts.blocked} fact_grounding=${factGroundingItem ? factGroundingItem.status : "not_run"}`
      );

      if (post!.qualityStatus === "needs_revision") {
        const autoFix = await runAutoFixAndRecheck(socialPostId);
        console.log(
          `[ops-03-piece-2] ${platform} auto-fix changesApplied=${autoFix.changesApplied.length} noSafeChangesFound=${autoFix.noSafeChangesFound} finalState=${autoFix.finalState}`
        );
      }
    }
    mark("quality_review_autofix_all", t0);
  }, 180_000);

  it("8. MultiPlatformReviewSummary 계산 + bulk approval", async () => {
    const t0 = Date.now();
    const posts = [];
    for (const platform of PLATFORMS) {
      const id = state.socialPostIds[platform];
      if (!id) continue;
      const post = await getSocialPostById(id);
      const checklist = Array.isArray(post!.qualitySummary?.checklist)
        ? (post!.qualitySummary.checklist as unknown as SocialPostQualityChecklistItem[])
        : [];
      const review = summarizeAutoReview(checklist);
      const userFacing = summarizeUserFacingReview(post!.qualityStatus, review, checklist);
      posts.push({ id: post!.id, approvalStatus: post!.approvalStatus, review: userFacing });
    }
    const reviewSummary = summarizeMultiPlatformReview(posts);
    console.log(
      `[ops-03-piece-2] MultiPlatformReviewSummary total=${reviewSummary.total} ready=${reviewSummary.ready} needsConfirmation=${reviewSummary.needsConfirmation} blocked=${reviewSummary.blocked} failed=${reviewSummary.failed} bulkEligible=${reviewSummary.bulkApprovalEligiblePostIds.length}`
    );

    const bulkResult = await bulkApproveSocialPosts(reviewSummary.bulkApprovalEligiblePostIds, APPROVED_BY);
    console.log(`[ops-03-piece-2] bulkApprove success=${bulkResult.successCount} failure=${bulkResult.failureCount}`);
    for (const f of bulkResult.failures) console.log(`[ops-03-piece-2] bulk approve failure: ${f.socialPostId} - ${f.message}`);
    mark("review_summary_bulk_approve", t0);

    for (const platform of PLATFORMS) {
      const id = state.socialPostIds[platform];
      if (!id) continue;
      const post = await getSocialPostById(id);
      if (post!.approvalStatus !== "approved") {
        console.log(`[ops-03-piece-2] ${platform} 아직 승인되지 않음(approvalStatus=${post!.approvalStatus}) — 수동 확인 필요 항목으로 기록`);
      }
    }
  }, 60_000);

  it("9. 승인 완료 post의 다음 작업 확인 — copy만 있고 '게시하기'/자동 posted 없음", async () => {
    for (const platform of PLATFORMS) {
      const id = state.socialPostIds[platform];
      if (!id) continue;
      const post = await getSocialPostById(id);
      if (post!.approvalStatus !== "approved") continue;
      const next = getPostApprovalNextActions({ platform: post!.platform, apiConfigured: false });
      console.log(`[ops-03-piece-2] ${platform} next action = ${next.primaryAction.actionType} (${next.primaryAction.label}) manualPostStatus=${post!.manualPostStatus}`);
      expect(next.primaryAction.actionType).not.toBe("publish");
      expect(next.primaryAction.label).not.toContain("게시하기");
      // OPS-03 정책: recordManualPostingResult를 호출하지 않는다 — 실제로
      // 외부에 게시하지 않았으므로 manualPostStatus는 절대 "posted"가
      // 아니어야 한다(허위 완료 기록 금지).
      expect(post!.manualPostStatus).not.toBe("posted");
    }
  });

  it("10. 결과 요약 출력(운영 로그 작성용)", async () => {
    console.log(`[ops-03-piece-2] themeId=${state.themeId} articleId=${state.articleId}`);
    for (const platform of PLATFORMS) {
      console.log(`[ops-03-piece-2] ${platform} socialPostId=${state.socialPostIds[platform] ?? "(생성 실패)"}`);
    }
    console.log(`[ops-03-piece-2] timings=${JSON.stringify(state.timings)}`);
  });
});
