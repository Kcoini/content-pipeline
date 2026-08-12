// Phase 3-11: Rewrite Application & Versioning Workflow.
// 승인된(approved) rewrite suggestion을 실제 social_posts에 반영하되,
// 기존 row는 절대 덮어쓰지 않고 새 버전(row)을 만든다. 새 버전은
// quality/approval/export/guard/dry-run/handoff/manual_post/performance
// 상태가 모두 초기화된 채로 시작하며, 곧바로 published가 되지 않는다.
// 실제 외부 플랫폼 게시는 어떤 경우에도 수행하지 않는다.

import {
  getSocialPostById,
  createRewriteVersion,
  updateSocialPostVersionStatus,
  listRewriteVersionsByRoot,
} from "@/lib/repositories/social-posts-repository";
import {
  getRewriteSuggestionById,
  updateRewriteSuggestionApplicationStatus,
  markRewriteSuggestionApplied,
} from "@/lib/repositories/social-rewrite-suggestions-repository";
import { createSocialPostVersion, markSocialPostVersionStatus } from "@/lib/repositories/social-post-versions-repository";
import { checkForbiddenPatterns } from "./platform-publishing-rules";
import { logEvent } from "@/lib/harness/logger";
import type { LogEventType, LogStatus } from "@/lib/harness/logger";
import type { SocialPost, ThreadItem, CardItem, ToneStyle } from "./social-platform-types";
import type { SocialPostRewriteSuggestion } from "./social-rewrite-types";

export interface ApplyRewriteSuggestionResult {
  success: boolean;
  message: string;
  newSocialPost?: SocialPost;
}

async function logApplicationEvent(
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

function collectSuggestionText(suggestion: SocialPostRewriteSuggestion): string {
  const threadText = suggestion.suggestedThreadItems.map((item) => item.text).join(" ");
  const cardText = suggestion.suggestedCardItems.map((item) => `${item.heading} ${item.body}`).join(" ");
  return [suggestion.suggestedTitle, suggestion.suggestedHook, suggestion.suggestedCta, threadText, cardText].filter(Boolean).join(" ");
}

/** 적용할 수 없는 이유를 반환한다. 가능하면 null. */
function checkApplicable(suggestion: SocialPostRewriteSuggestion): string | null {
  if (suggestion.suggestionStatus === "blocked") return "suggestion_status가 blocked여서 적용할 수 없습니다.";
  if (suggestion.suggestionStatus === "rejected") return "suggestion_status가 rejected여서 적용할 수 없습니다.";
  if (suggestion.suggestionStatus === "failed") return "suggestion_status가 failed여서 적용할 수 없습니다.";
  if (suggestion.suggestionStatus !== "approved") {
    return `suggestion_status가 'approved'가 아니어서(${suggestion.suggestionStatus}) 적용할 수 없습니다.`;
  }
  if (suggestion.applicationStatus === "applied") return "이미 적용된 제안입니다(중복 적용 불가).";

  const forbidden = checkForbiddenPatterns(collectSuggestionText(suggestion));
  if (forbidden.blocked) return `금지 표현이 발견되어 적용할 수 없습니다: ${forbidden.found.join(", ")}`;

  return null;
}

/** 병합된 콘텐츠가 원본과 실제로 다른 필드만 골라낸다. */
function computeChangedFields(original: SocialPost, merged: ReturnType<typeof mergeContentFromSuggestion>): string[] {
  const changed: string[] = [];
  if (merged.postTitle !== original.postTitle) changed.push("post_title");
  if (merged.postBody !== original.postBody) changed.push("post_body");
  if (merged.caption !== original.caption) changed.push("caption");
  if (merged.excerpt !== original.excerpt) changed.push("excerpt");
  if (JSON.stringify(merged.hashtags) !== JSON.stringify(original.hashtags)) changed.push("hashtags");
  if (JSON.stringify(merged.threadItems) !== JSON.stringify(original.threadItems)) changed.push("thread_items");
  if (JSON.stringify(merged.cardItems) !== JSON.stringify(original.cardItems)) changed.push("card_items");
  if (merged.toneStyle !== original.toneStyle) changed.push("tone_style");
  return changed;
}

/** 기존 social post와 suggestion을 병합해 새 버전의 콘텐츠 필드를 만든다. 기존 row는 수정하지 않는다. */
function mergeContentFromSuggestion(original: SocialPost, suggestion: SocialPostRewriteSuggestion) {
  const postTitle = suggestion.suggestedTitle ?? original.postTitle;
  const hookPrefix = suggestion.suggestedHook ? `${suggestion.suggestedHook}\n\n` : "";
  const ctaSuffix = suggestion.suggestedCta ? `\n\n${suggestion.suggestedCta}` : "";
  const basedOnOriginalBody = original.postBody ?? original.caption ?? "";
  const postBody = original.postBody !== null || suggestion.suggestedHook || suggestion.suggestedCta
    ? `${hookPrefix}${basedOnOriginalBody}${ctaSuffix}`.trim() || null
    : original.postBody;
  const caption = suggestion.suggestedHook && original.caption !== null ? `${suggestion.suggestedHook}\n\n${original.caption}`.trim() : original.caption;
  const hashtags = suggestion.suggestedHashtags.length > 0 ? suggestion.suggestedHashtags : original.hashtags;
  const threadItems: ThreadItem[] = suggestion.suggestedThreadItems.length > 0 ? suggestion.suggestedThreadItems : original.threadItems;
  const cardItems: CardItem[] = suggestion.suggestedCardItems.length > 0 ? suggestion.suggestedCardItems : original.cardItems;
  const toneStyle: ToneStyle = suggestion.suggestedToneStyle ?? original.toneStyle;
  const excerpt = suggestion.suggestedHook ?? original.excerpt;

  return { postTitle, postBody, caption, excerpt, hashtags, threadItems, cardItems, toneStyle };
}

/**
 * 승인된 rewrite suggestion을 적용해 새 social_posts 버전을 만든다.
 * 기존 social_post는 절대 수정/삭제하지 않는다. 새 버전은 quality gate/
 * approval/export/guard/dry-run/handoff/manual posting을 모두 처음부터
 * 다시 거쳐야 하며, 이 함수는 publish_status를 published로 만들지
 * 않는다.
 */
export async function applyRewriteSuggestion(
  suggestionId: string,
  appliedBy?: string,
  notes?: string
): Promise<ApplyRewriteSuggestionResult> {
  const suggestion = await getRewriteSuggestionById(suggestionId);
  if (!suggestion) {
    return { success: false, message: `rewrite suggestion을 찾을 수 없습니다: ${suggestionId}` };
  }

  await logApplicationEvent(
    "social_rewrite_application_started",
    "info",
    `rewrite suggestion(${suggestionId})의 적용을 시작합니다.`,
    suggestion.articleId,
    { suggestionId, originalSocialPostId: suggestion.socialPostId, platform: suggestion.platform, toneStyle: suggestion.toneStyle }
  );

  const original = await getSocialPostById(suggestion.socialPostId);
  if (!original) {
    const message = `원본 social post를 찾을 수 없습니다: ${suggestion.socialPostId}`;
    await logApplicationEvent("social_rewrite_application_blocked", "failed", message, suggestion.articleId, {
      suggestionId,
      reasonCode: "original_not_found",
    });
    return { success: false, message };
  }

  const blockReason = checkApplicable(suggestion);
  if (blockReason) {
    await updateRewriteSuggestionApplicationStatus(suggestionId, { applicationStatus: "blocked", applicationError: blockReason });
    await logApplicationEvent("social_rewrite_application_blocked", "failed", blockReason, suggestion.articleId, {
      suggestionId,
      originalSocialPostId: suggestion.socialPostId,
      platform: suggestion.platform,
      reasonCode: "not_applicable",
    });
    return { success: false, message: blockReason };
  }

  try {
    const rootSocialPostId = original.rootSocialPostId ?? original.id;
    const existingVersions = await listRewriteVersionsByRoot(rootSocialPostId);
    const nextVersionNumber = existingVersions.reduce((max, v) => Math.max(max, v.versionNumber), 0) + 1;

    const merged = mergeContentFromSuggestion(original, suggestion);

    const newSocialPost = await createRewriteVersion({
      articleId: original.articleId,
      platform: original.platform,
      toneStyle: merged.toneStyle,
      postTitle: merged.postTitle,
      postBody: merged.postBody,
      caption: merged.caption,
      excerpt: merged.excerpt,
      hashtags: merged.hashtags,
      threadItems: merged.threadItems,
      cardItems: merged.cardItems,
      mediaRequirements: original.mediaRequirements,
      platformMetadata: original.platformMetadata,
      parentSocialPostId: original.id,
      rootSocialPostId,
      versionNumber: nextVersionNumber,
      versionLabel: `Rewrite v${nextVersionNumber}`,
      rewriteSourceSuggestionId: suggestionId,
      rewriteAppliedFromSocialPostId: original.id,
      rewriteAppliedBy: appliedBy ?? null,
      rewriteApplicationNotes: notes ?? null,
    });

    await logApplicationEvent(
      "social_rewrite_version_created",
      "success",
      `social post(${original.id})의 새 버전(${newSocialPost.id}, v${nextVersionNumber})이 생성되었습니다.`,
      original.articleId,
      {
        originalSocialPostId: original.id,
        newSocialPostId: newSocialPost.id,
        rootSocialPostId,
        parentSocialPostId: original.id,
        versionNumber: nextVersionNumber,
      }
    );

    await createSocialPostVersion({
      socialPostId: newSocialPost.id,
      articleId: original.articleId,
      rootSocialPostId,
      parentSocialPostId: original.id,
      versionNumber: nextVersionNumber,
      versionLabel: `Rewrite v${nextVersionNumber}`,
      versionStatus: "current",
      platform: original.platform,
      toneStyle: merged.toneStyle,
      rewriteSourceSuggestionId: suggestionId,
      changeSummary: { changedFields: computeChangedFields(original, merged) },
      appliedBy: appliedBy ?? null,
      appliedAt: new Date().toISOString(),
    });

    await updateSocialPostVersionStatus(original.id, "superseded");
    await markSocialPostVersionStatus(original.id, "superseded");

    await markRewriteSuggestionApplied(suggestionId, newSocialPost.id, notes ?? null);

    const changedFields = computeChangedFields(original, merged);

    await logApplicationEvent(
      "social_rewrite_application_completed",
      "success",
      `rewrite suggestion(${suggestionId})이 social post(${newSocialPost.id})로 적용되었습니다.`,
      original.articleId,
      {
        suggestionId,
        originalSocialPostId: original.id,
        newSocialPostId: newSocialPost.id,
        articleId: original.articleId,
        platform: original.platform,
        toneStyle: original.toneStyle,
        suggestedToneStyle: suggestion.suggestedToneStyle,
        rootSocialPostId,
        parentSocialPostId: original.id,
        versionNumber: nextVersionNumber,
        changedFieldCount: changedFields.length,
        changedFields,
        hashtagCount: newSocialPost.hashtags.length,
        threadItemCount: newSocialPost.threadItems.length,
        cardItemCount: newSocialPost.cardItems.length,
      }
    );

    return {
      success: true,
      message: `rewrite suggestion을 적용해 새 버전(v${nextVersionNumber})을 생성했습니다. Quality Gate/Approval을 다시 진행해야 합니다.`,
      newSocialPost,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    await updateRewriteSuggestionApplicationStatus(suggestionId, { applicationStatus: "failed", applicationError: message }).catch(
      () => undefined
    );
    await logApplicationEvent("social_rewrite_application_failed", "failed", `rewrite suggestion 적용 실패: ${message}`, suggestion.articleId, {
      suggestionId,
      originalSocialPostId: suggestion.socialPostId,
    });
    return { success: false, message };
  }
}
