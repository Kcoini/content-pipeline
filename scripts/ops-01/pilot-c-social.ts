import "./load-env";

import { describe, it, expect } from "vitest";
import { runContractForCollection } from "@/lib/harness/contract-runner";
import { loadContract } from "@/lib/harness/load-contract";
import { logEvent } from "@/lib/harness/logger";
import { createTheme, getThemeById } from "@/lib/repositories/theme-repository";
import { addSource, getSourcesByThemeId, updateSourceFetchResult, updateSourceSummary } from "@/lib/repositories/source-repository";
import { fetchUrlContent } from "@/lib/services/url-fetcher";
import { generateSourceSummaryWithAi } from "@/lib/ai/source-auto-summarizer";
import { saveDraftArticle } from "@/lib/repositories/article-repository";
import { buildMasterManuscript } from "@/lib/articles/master-manuscript-builder";
import { saveArticleMasterManuscript } from "@/lib/repositories/article-repository";
import { evaluateArticleForMode } from "@/lib/ai/eval-article";
import { saveEvalRun } from "@/lib/repositories/eval-repository";
import { generateAiArticleDraft } from "@/lib/ai/article-writer";
import { summarizeSourcesWithAi } from "@/lib/ai/source-summarizer";
import { shouldUseAnthropic } from "@/lib/ai/ai-config";
import { getArticleModeConfig } from "@/lib/articles/article-modes";
import { approveArticle } from "@/lib/repositories/article-repository";
import { generateSelectedPlatformPosts } from "@/lib/social/multi-platform-generation-service";
import { getSocialPostById } from "@/lib/repositories/social-posts-repository";
import { runSocialPostQualityGateAndSave } from "@/lib/social/social-post-service";
import { summarizeAutoReview, summarizeUserFacingReview } from "@/lib/social/social-post-auto-review";
import { runAutoFixAndRecheck } from "@/lib/social/post-auto-fix-service";
import { bulkApproveSocialPosts } from "@/lib/social/social-post-approval-service";
import { summarizeMultiPlatformReview } from "@/lib/ui/multi-platform-review-summary";
import { getPostApprovalNextActions } from "@/lib/social/post-approval-next-actions";
import type { SocialPlatform } from "@/lib/social/social-platform-types";

const APPROVED_BY = "ops-01-pilot-c";
const PLATFORMS: SocialPlatform[] = ["x", "threads", "instagram"];

// 실제 공개 정보 출처(Wikipedia, 네트워크 도달 확인됨) — 개인정보/민감정보 없음.
const SOURCES = [
  {
    url: "https://ko.wikipedia.org/wiki/%EB%A6%AC%ED%8A%AC%EC%9D%B4%EC%98%A8_%EC%A0%84%EC%A7%80",
    title: "리튬이온 전지",
    publisher: "위키백과",
  },
  {
    url: "https://ko.wikipedia.org/wiki/%EC%A0%84%EA%B8%B0%EC%9E%90%EB%8F%99%EC%B0%A8",
    title: "전기자동차",
    publisher: "위키백과",
  },
  {
    url: "https://ko.wikipedia.org/wiki/%EB%B0%B0%ED%84%B0%EB%A6%AC_%EA%B4%80%EB%A6%AC_%EC%8B%9C%EC%8A%A4%ED%85%9C",
    title: "배터리 관리 시스템",
    publisher: "위키백과",
  },
];

const THEME_TITLE = "전기차 배터리 수명을 늘리는 충전 습관";

const state: {
  themeId?: string;
  articleId?: string;
  socialPostIds: Partial<Record<SocialPlatform, string>>;
  timings: Record<string, number>;
} = { socialPostIds: {}, timings: {} };

function mark(label: string, startedAt: number) {
  state.timings[label] = Date.now() - startedAt;
  console.log(`[ops-01-pilot-c] ${label}: ${state.timings[label]}ms`);
}

describe("OPS-01 Pilot C: SNS 다중 플랫폼(x/threads/instagram) 실제 파일럿", () => {
  it("1. Theme 생성", async () => {
    const t0 = Date.now();
    const theme = await createTheme({
      title: THEME_TITLE,
      description: "전기차 배터리를 오래 쓰기 위한 충전 습관과 배터리 관리 시스템(BMS)의 역할을 설명하는 정보성 콘텐츠",
      keywords: ["전기차", "배터리 수명", "충전 습관", "BMS"],
      language: "ko",
    });
    state.themeId = theme.id;
    mark("theme_create", t0);
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
        console.log(`[ops-01-pilot-c] source fetch failed: ${s.url} (${fetchResult.status})`);
      }
    }
    mark("sources_add_fetch_summarize", t0);
    const sources = await getSourcesByThemeId(themeId);
    expect(sources.length).toBe(3);
  });

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
    expect(shouldUseAnthropic()).toBe(true);

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

    try {
      const mm = buildMasterManuscript(article, citedSources);
      await saveArticleMasterManuscript(article.id, mm);
    } catch (e) {
      console.log(`[ops-01-pilot-c] master manuscript 저장 실패(부가 데이터, 무시): ${e instanceof Error ? e.message : e}`);
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

    await logEvent({
      type: "article_generation_completed",
      status: "success",
      message: "OPS-01 Pilot C 마스터 원고 생성 완료",
      details: { themeId, articleId: article.id, aggregateScore: evalResult.aggregateScore, passed: evalResult.passed },
      themeId,
      articleId: article.id,
    });

    expect(article.status).toBe("draft");
    console.log(`[ops-01-pilot-c] article eval passed=${evalResult.passed}, score=${evalResult.aggregateScore}`);
  });

  it("5. 마스터 원고 승인(reviewed)", async () => {
    const article = await approveArticle({ articleId: state.articleId!, approvedBy: APPROVED_BY });
    expect(article.status).toBe("reviewed");
  });

  it("6. x/threads/instagram 3개 플랫폼 글 생성(실제 AI 호출)", async () => {
    const t0 = Date.now();
    const summary = await generateSelectedPlatformPosts({
      articleId: state.articleId!,
      platforms: PLATFORMS,
      toneMode: "auto_recommended",
    });
    mark("platform_generation_all", t0);
    if ("error" in summary) throw new Error(summary.error);

    for (const r of summary.results) {
      console.log(`[ops-01-pilot-c] platform=${r.platform} status=${r.status} tone=${r.toneStyle ?? "-"}`);
      if (r.socialPostId) state.socialPostIds[r.platform] = r.socialPostId;
    }
    expect(summary.generatedCount).toBe(3);
    expect(summary.failedCount).toBe(0);
  });

  it("7. 플랫폼별 품질 검사 + 자동 검토 + 자동 수정", async () => {
    const t0 = Date.now();
    for (const platform of PLATFORMS) {
      const socialPostId = state.socialPostIds[platform];
      expect(socialPostId, `${platform} social post id 없음`).toBeTruthy();

      const gateResult = await runSocialPostQualityGateAndSave(socialPostId!);
      console.log(`[ops-01-pilot-c] ${platform} quality gate success=${gateResult.success} status=${gateResult.socialPost?.qualityStatus}`);

      const post = await getSocialPostById(socialPostId!);
      expect(post).toBeTruthy();
      const checklist = Array.isArray(post!.qualitySummary?.checklist) ? (post!.qualitySummary.checklist as never[]) : [];
      const review = summarizeAutoReview(checklist);
      const userFacing = summarizeUserFacingReview(post!.qualityStatus, review, checklist);
      console.log(
        `[ops-01-pilot-c] ${platform} review state=${userFacing.state} confirmationCount=${userFacing.confirmationCount} hiddenAutoFixable=${userFacing.hiddenAutoFixableCount}`
      );

      if (post!.qualityStatus === "needs_revision") {
        const autoFix = await runAutoFixAndRecheck(socialPostId!);
        console.log(
          `[ops-01-pilot-c] ${platform} auto-fix changesApplied=${autoFix.changesApplied.length} noSafeChangesFound=${autoFix.noSafeChangesFound} finalState=${autoFix.finalState}`
        );
      }
    }
    mark("quality_review_autofix_all", t0);
  });

  it("8. MultiPlatformReviewSummary 계산 + bulk approval", async () => {
    const t0 = Date.now();
    const posts = [];
    for (const platform of PLATFORMS) {
      const post = await getSocialPostById(state.socialPostIds[platform]!);
      const checklist = Array.isArray(post!.qualitySummary?.checklist) ? (post!.qualitySummary.checklist as never[]) : [];
      const review = summarizeAutoReview(checklist);
      const userFacing = summarizeUserFacingReview(post!.qualityStatus, review, checklist);
      posts.push({ id: post!.id, approvalStatus: post!.approvalStatus, review: userFacing });
    }
    const reviewSummary = summarizeMultiPlatformReview(posts);
    console.log(
      `[ops-01-pilot-c] MultiPlatformReviewSummary total=${reviewSummary.total} ready=${reviewSummary.ready} needsConfirmation=${reviewSummary.needsConfirmation} blocked=${reviewSummary.blocked} failed=${reviewSummary.failed} bulkEligible=${reviewSummary.bulkApprovalEligiblePostIds.length}`
    );

    const bulkResult = await bulkApproveSocialPosts(reviewSummary.bulkApprovalEligiblePostIds, APPROVED_BY);
    console.log(`[ops-01-pilot-c] bulkApprove success=${bulkResult.successCount} failure=${bulkResult.failureCount}`);
    for (const f of bulkResult.failures) console.log(`[ops-01-pilot-c] bulk approve failure: ${f.socialPostId} - ${f.message}`);
    mark("review_summary_bulk_approve", t0);

    // needsConfirmation/blocked 상태라 bulk 대상에서 빠진 post는 개별 승인 시도(승인 가능하면 승인, 아니면 이유를 남긴다).
    for (const platform of PLATFORMS) {
      const id = state.socialPostIds[platform]!;
      const post = await getSocialPostById(id);
      if (post!.approvalStatus !== "approved") {
        console.log(`[ops-01-pilot-c] ${platform} 아직 승인되지 않음(approvalStatus=${post!.approvalStatus}) — 수동 확인 필요 항목으로 기록`);
      }
    }
  });

  it("9. 승인 완료 post의 다음 작업(copy_body) 확인 — 게시하기 버튼 없음", async () => {
    for (const platform of PLATFORMS) {
      const post = await getSocialPostById(state.socialPostIds[platform]!);
      if (post!.approvalStatus !== "approved") continue;
      const next = getPostApprovalNextActions({ platform: post!.platform, apiConfigured: false });
      console.log(`[ops-01-pilot-c] ${platform} next action = ${next.primaryAction.actionType} (${next.primaryAction.label})`);
      expect(next.primaryAction.actionType).not.toBe("publish");
      expect(next.primaryAction.label).not.toContain("게시하기");
    }
  });

  it("10. 결과 요약 출력(문서 작성용)", async () => {
    console.log(`[ops-01-pilot-c] themeId=${state.themeId} articleId=${state.articleId}`);
    for (const platform of PLATFORMS) {
      console.log(`[ops-01-pilot-c] ${platform} socialPostId=${state.socialPostIds[platform]}`);
    }
    console.log(`[ops-01-pilot-c] timings=${JSON.stringify(state.timings)}`);
  });
});
