// Phase 3-10: Performance-based Rewrite Suggestion — 생성 서비스.
// 진단(diagnosis) 결과와 플랫폼/문체별 개선 전략을 바탕으로 rule-based
// 개선 제안을 만들어 별도 테이블에 저장한다. 기존 social_posts의
// post_body/caption/thread_items/card_items는 절대 수정하지 않는다.
// SOCIAL_REWRITE_AI_ENABLED=true여도 이번 단계는 실제 API를 호출하지
// 않는다(다음 단계에서 연결 예정).

import { getSocialPostById } from "@/lib/repositories/social-posts-repository";
import {
  createRewriteSuggestion,
  updateSocialPostRewriteSuggestionSummary,
} from "@/lib/repositories/social-rewrite-suggestions-repository";
import { diagnoseSocialPostPerformance } from "./performance-rewrite-diagnosis-service";
import { getPlatformRewriteStrategy } from "./platform-rewrite-strategies";
import { getToneRewriteStrategy } from "./tone-rewrite-strategies";
import { applyToneTransform } from "./tone-transformer-rules";
import { validateRewriteSuggestion } from "./rewrite-suggestion-validator";
import { isSocialRewriteAiEnabled } from "./social-rewrite-ai-config";
import { logEvent } from "@/lib/harness/logger";
import type { LogEventType, LogStatus } from "@/lib/harness/logger";
import type { SocialPost, ThreadItem, CardItem } from "./social-platform-types";
import type { CreateRewriteSuggestionInput, PerformanceDiagnosisResult, SocialPostRewriteSuggestion } from "./social-rewrite-types";

export interface GenerateRewriteSuggestionResult {
  success: boolean;
  message: string;
  suggestion?: SocialPostRewriteSuggestion;
  diagnosis?: PerformanceDiagnosisResult;
}

async function logRewriteEvent(
  type: LogEventType,
  status: LogStatus,
  message: string,
  articleId: string,
  details?: Record<string, unknown>
): Promise<void> {
  await logEvent({
    type,
    status,
    message,
    articleId,
    targetType: "article",
    targetId: articleId,
    ...(details ? { details } : {}),
  });
}

/**
 * rule-based(mock) 개선 제안 콘텐츠를 만든다. 실제 AI 호출 없이,
 * 기존 제목/본문에 플랫폼·문체 개선 방향을 반영한 결정론적 텍스트를
 * 생성한다. 원문을 그대로 복사하지 않는다.
 */
function buildMockRewriteContent(
  post: SocialPost,
  diagnosis: PerformanceDiagnosisResult,
  platformAreas: string[],
  toneDirections: string[]
): Pick<
  CreateRewriteSuggestionInput,
  | "suggestedTitle"
  | "suggestedHook"
  | "suggestedBodyOutline"
  | "suggestedCta"
  | "suggestedHashtags"
  | "suggestedThreadItems"
  | "suggestedCardItems"
  | "suggestedToneStyle"
> {
  const primaryArea = platformAreas[0] ?? "개선";
  const baseTitle = post.postTitle ?? post.caption ?? "제목 없음";
  const suggestedTitle = `[개선 제안] ${baseTitle} — ${primaryArea}`;
  const suggestedHook = applyToneTransform(post.toneStyle, `${toneDirections[0] ?? "핵심을"} 반영한 새로운 도입부`);
  const suggestedCta = "더 궁금하신 내용은 댓글로 남겨주세요.";
  const suggestedHashtags = Array.from(new Set(post.hashtags.map((tag) => tag.trim()).filter(Boolean))).slice(0, 8);

  const suggestedBodyOutline = [
    { order: 1, heading: "개선된 도입부" },
    { order: 2, heading: diagnosis.improvementTargets.includes("hook_weak") ? "핵심 요약 (hook 강화)" : "핵심 요약" },
    { order: 3, heading: "본문 개선 포인트" },
    { order: 4, heading: "마무리 및 CTA" },
  ];

  let suggestedThreadItems: ThreadItem[] = [];
  if (post.platform === "x") {
    const base = post.threadItems.length > 0 ? post.threadItems : [{ order: 1, text: baseTitle }];
    suggestedThreadItems = base.map((item, index) => ({
      order: index + 1,
      text: index === 0 ? `[개선 제안] ${applyToneTransform(post.toneStyle, item.text).slice(0, 260)}` : item.text.slice(0, 260),
    }));
  }

  let suggestedCardItems: CardItem[] = [];
  if (post.platform === "instagram") {
    const base = post.cardItems.length > 0 ? post.cardItems : [{ order: 1, heading: "핵심 포인트", body: baseTitle }];
    suggestedCardItems = base.map((item, index) => ({
      order: index + 1,
      heading: index === 0 ? `[개선 제안] ${item.heading}` : item.heading,
      body: item.body,
    }));
  }

  return {
    suggestedTitle,
    suggestedHook,
    suggestedBodyOutline,
    suggestedCta,
    suggestedHashtags,
    suggestedThreadItems,
    suggestedCardItems,
    suggestedToneStyle: post.toneStyle,
  };
}

/**
 * social post의 성과를 진단하고, 낮은 성과(또는 요청 시 그렇지 않은
 * 경우도)에 대해 rule-based 개선 제안을 생성해 저장한다. 기존
 * social_posts 본문은 수정하지 않는다.
 */
export async function generatePerformanceRewriteSuggestion(socialPostId: string): Promise<GenerateRewriteSuggestionResult> {
  const post = await getSocialPostById(socialPostId);
  if (!post) {
    return { success: false, message: `social post를 찾을 수 없습니다: ${socialPostId}` };
  }

  await logRewriteEvent(
    "social_rewrite_suggestion_started",
    "info",
    `social post(${socialPostId})의 성과 기반 개선 제안 생성을 시작합니다.`,
    post.articleId,
    { socialPostId, platform: post.platform, toneStyle: post.toneStyle, performanceStatus: post.performanceStatus, performanceScore: post.latestPerformanceScore }
  );

  try {
    const diagnosis = await diagnoseSocialPostPerformance(socialPostId);

    await logRewriteEvent(
      "social_rewrite_diagnosis_completed",
      "info",
      `social post(${socialPostId})의 성과 진단을 완료했습니다 (status: ${diagnosis.status}).`,
      post.articleId,
      {
        socialPostId,
        platform: post.platform,
        improvementTargetCount: diagnosis.improvementTargets.length,
        warningCount: diagnosis.warnings.length,
        blockedCount: diagnosis.blockedReasons.length,
      }
    );

    if (diagnosis.status === "blocked") {
      const message = diagnosis.blockedReasons.join(" / ") || "진단 결과 개선 제안을 생성할 수 없습니다.";
      await logRewriteEvent("social_rewrite_suggestion_blocked", "failed", message, post.articleId, {
        socialPostId,
        platform: post.platform,
        reasonCode: "diagnosis_blocked",
      });
      return { success: false, message, diagnosis };
    }

    const platformStrategy = getPlatformRewriteStrategy(post.platform);
    const toneStrategy = getToneRewriteStrategy(post.toneStyle);
    const content = buildMockRewriteContent(post, diagnosis, platformStrategy.improvementAreas, toneStrategy.improvementDirections);

    const aiEnabled = isSocialRewriteAiEnabled();

    const draft: CreateRewriteSuggestionInput = {
      socialPostId,
      articleId: post.articleId,
      platform: post.platform,
      toneStyle: post.toneStyle,
      originalPerformanceStatus: post.performanceStatus,
      originalPerformanceScore: post.latestPerformanceScore,
      suggestionStatus: diagnosis.status === "needs_review" ? "needs_review" : "ready",
      diagnosis: diagnosis.diagnosis,
      suggestedChanges: {
        improvementTargets: diagnosis.improvementTargets,
        platformAreas: platformStrategy.improvementAreas,
        toneDirections: toneStrategy.improvementDirections,
      },
      expectedImprovementReason:
        diagnosis.improvementTargets.length > 0
          ? `다음 영역을 개선하면 성과가 향상될 가능성이 있습니다: ${diagnosis.improvementTargets.join(", ")}.`
          : "현재도 양호하지만 추가로 시도해볼 수 있는 개선 방향입니다.",
      riskNotes: diagnosis.warnings,
      qualityNotes: platformStrategy.improvementAreas,
      generatedBy: aiEnabled ? "ai" : "mock",
      ...content,
    };

    const validation = validateRewriteSuggestion(draft);

    if (validation.blocked || !validation.valid) {
      const reason = validation.errors.join(" / ") || "rewrite suggestion 검증에 실패했습니다.";
      const blockedSuggestion = await createRewriteSuggestion({ ...draft, suggestionStatus: "blocked" });
      await updateSocialPostRewriteSuggestionSummary(socialPostId, blockedSuggestion);
      await logRewriteEvent("social_rewrite_suggestion_blocked", "failed", reason, post.articleId, {
        socialPostId,
        platform: post.platform,
        reasonCode: "validation_failed",
      });
      return { success: false, message: reason, suggestion: blockedSuggestion, diagnosis };
    }

    const suggestion = await createRewriteSuggestion(draft);
    await updateSocialPostRewriteSuggestionSummary(socialPostId, suggestion);

    await logRewriteEvent(
      "social_rewrite_suggestion_completed",
      "success",
      `social post(${socialPostId})의 개선 제안을 생성했습니다 (status: ${suggestion.suggestionStatus}).`,
      post.articleId,
      {
        socialPostId,
        platform: post.platform,
        toneStyle: post.toneStyle,
        suggestionStatus: suggestion.suggestionStatus,
        improvementTargetCount: diagnosis.improvementTargets.length,
        hasSuggestedTitle: Boolean(suggestion.suggestedTitle),
        hasSuggestedHook: Boolean(suggestion.suggestedHook),
        hasSuggestedCta: Boolean(suggestion.suggestedCta),
        hashtagCount: suggestion.suggestedHashtags.length,
        threadItemCount: suggestion.suggestedThreadItems.length,
        cardItemCount: suggestion.suggestedCardItems.length,
      }
    );

    return { success: true, message: `개선 제안을 생성했습니다 (status: ${suggestion.suggestionStatus}).`, suggestion, diagnosis };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    await logRewriteEvent("social_rewrite_suggestion_failed", "failed", `개선 제안 생성 실패: ${message}`, post.articleId, {
      socialPostId,
      platform: post.platform,
    });
    return { success: false, message };
  }
}
