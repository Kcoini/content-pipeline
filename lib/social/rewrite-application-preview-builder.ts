// Phase 3-11: Rewrite Application & Versioning Workflow — 적용 전 preview.
// 실제로 새 버전을 만들지 않고, 무엇이 바뀔지만 미리 보여준다. full
// body 전문은 이 결과에 포함되더라도 로그에는 저장하지 않는다(그 책임은
// 호출하는 쪽에 있다 — 이 함수 자체는 로그를 남기지 않는다).

import { getSocialPostById } from "@/lib/repositories/social-posts-repository";
import { getRewriteSuggestionById } from "@/lib/repositories/social-rewrite-suggestions-repository";

export interface RewriteApplicationPreviewOriginal {
  socialPostId: string;
  platform: string;
  toneStyle: string;
  versionNumber: number;
  postTitlePreview: string | null;
  postBodyLength: number;
  captionLength: number;
  hashtagCount: number;
  threadItemCount: number;
  cardItemCount: number;
}

export interface RewriteApplicationPreviewProposed {
  suggestedTitle: string | null;
  suggestedHook: string | null;
  suggestedCta: string | null;
  suggestedToneStyle: string | null;
  suggestedHashtagCount: number;
  suggestedThreadItemCount: number;
  suggestedCardItemCount: number;
  expectedChangedFields: string[];
}

export interface RewriteApplicationPreviewResult {
  ok: boolean;
  original?: RewriteApplicationPreviewOriginal;
  proposed?: RewriteApplicationPreviewProposed;
  changes: string[];
  warnings: string[];
  blockedReasons: string[];
  error?: string;
}

function truncate(text: string | null, length: number): string | null {
  if (!text) return null;
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

/**
 * rewrite suggestion을 적용하면 무엇이 바뀔지 미리 보여준다. 실제로
 * 아무것도 생성/수정하지 않는다(읽기 전용).
 */
export async function buildRewriteApplicationPreview(suggestionId: string): Promise<RewriteApplicationPreviewResult> {
  const suggestion = await getRewriteSuggestionById(suggestionId);
  if (!suggestion) {
    return { ok: false, changes: [], warnings: [], blockedReasons: [], error: `rewrite suggestion을 찾을 수 없습니다: ${suggestionId}` };
  }

  const original = await getSocialPostById(suggestion.socialPostId);
  if (!original) {
    return { ok: false, changes: [], warnings: [], blockedReasons: [], error: `원본 social post를 찾을 수 없습니다: ${suggestion.socialPostId}` };
  }

  const blockedReasons: string[] = [];
  const warnings: string[] = [];

  if (suggestion.suggestionStatus === "blocked") blockedReasons.push("suggestion_status가 blocked입니다.");
  if (suggestion.suggestionStatus === "rejected") blockedReasons.push("suggestion_status가 rejected입니다.");
  if (suggestion.applicationStatus === "applied") warnings.push("이미 적용된 제안입니다 — 다시 적용하면 새 버전이 추가됩니다.");
  if (suggestion.suggestionStatus !== "approved") warnings.push(`suggestion_status가 'approved'가 아닙니다(${suggestion.suggestionStatus}) — 적용하려면 먼저 승인이 필요합니다.`);

  const expectedChangedFields: string[] = [];
  if (suggestion.suggestedTitle) expectedChangedFields.push("post_title");
  if (suggestion.suggestedHook) expectedChangedFields.push("post_body(hook)");
  if (suggestion.suggestedCta) expectedChangedFields.push("post_body(cta)");
  if (suggestion.suggestedHashtags.length > 0) expectedChangedFields.push("hashtags");
  if (suggestion.suggestedThreadItems.length > 0) expectedChangedFields.push("thread_items");
  if (suggestion.suggestedCardItems.length > 0) expectedChangedFields.push("card_items");
  if (suggestion.suggestedToneStyle) expectedChangedFields.push("tone_style");

  const changes = expectedChangedFields.map((field) => `${field} 필드가 제안값으로 교체됩니다.`);

  return {
    ok: true,
    original: {
      socialPostId: original.id,
      platform: original.platform,
      toneStyle: original.toneStyle,
      versionNumber: original.versionNumber,
      postTitlePreview: truncate(original.postTitle, 60),
      postBodyLength: original.postBody?.length ?? 0,
      captionLength: original.caption?.length ?? 0,
      hashtagCount: original.hashtags.length,
      threadItemCount: original.threadItems.length,
      cardItemCount: original.cardItems.length,
    },
    proposed: {
      suggestedTitle: truncate(suggestion.suggestedTitle, 80),
      suggestedHook: truncate(suggestion.suggestedHook, 80),
      suggestedCta: truncate(suggestion.suggestedCta, 80),
      suggestedToneStyle: suggestion.suggestedToneStyle,
      suggestedHashtagCount: suggestion.suggestedHashtags.length,
      suggestedThreadItemCount: suggestion.suggestedThreadItems.length,
      suggestedCardItemCount: suggestion.suggestedCardItems.length,
      expectedChangedFields,
    },
    changes,
    warnings,
    blockedReasons,
  };
}
