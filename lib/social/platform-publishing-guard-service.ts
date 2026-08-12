// Phase 3-6: Platform-specific Approval & Publishing Guard.
// 실제 플랫폼 게시 API 호출 전 단계로, social post가 플랫폼별 게시 가능
// 조건을 통과하는지 검사한다. 이 서비스는 어떤 경우에도 실제 외부
// 플랫폼 게시를 수행하지 않으며, publish_status를 'published'로 바꾸지
// 않는다. platform_publish_ready=true는 "게시 가능 조건 통과"일 뿐
// "실제 게시 완료"가 아니다.

import {
  getSocialPostForPublishingGuard,
  updatePlatformPublishGuardResult,
  markPlatformPublishGuardFailed,
} from "@/lib/repositories/social-posts-repository";
import { isSocialPlatform, isToneStyle } from "./social-platform-types";
import type {
  PlatformPublishGuardChecklistItem,
  PlatformPublishGuardResult,
  SocialPlatform,
  SocialPost,
} from "./social-platform-types";
import { getPlatformWritingConfig } from "./platform-writing-config";
import { checkForbiddenPatterns, checkPlatformSpecificRisks, calculatePublishingGuardScore } from "./platform-publishing-rules";
import { logEvent } from "@/lib/harness/logger";
import type { LogEventType, LogStatus } from "@/lib/harness/logger";

const READY_SCORE_THRESHOLD = 85;
const X_MAX_ITEM_LENGTH = 280;

async function logGuardEvent(
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

function item(
  key: string,
  label: string,
  status: PlatformPublishGuardChecklistItem["status"],
  message: string
): PlatformPublishGuardChecklistItem {
  return { key, label, status, message };
}

function hasAnyContent(post: SocialPost): boolean {
  return Boolean(
    (post.postTitle && post.postTitle.trim().length > 0) ||
      (post.postBody && post.postBody.trim().length > 0) ||
      (post.caption && post.caption.trim().length > 0) ||
      (post.threadItems.length > 0 && post.threadItems.some((t) => t.text.trim().length > 0)) ||
      (post.cardItems.length > 0 && post.cardItems.some((c) => c.body.trim().length > 0))
  );
}

function collectText(post: SocialPost): string {
  const threadText = post.threadItems.map((t) => t.text).join(" ");
  const cardText = post.cardItems.map((c) => `${c.heading} ${c.body}`).join(" ");
  return [post.postTitle, post.postBody, post.caption, post.excerpt, threadText, cardText].filter(Boolean).join(" ");
}

/** 공통 게시 가능 조건("hard gate")을 검사한다. blocked 사유가 있으면 즉시 반환한다. */
function buildCommonGateChecklist(post: SocialPost): PlatformPublishGuardChecklistItem[] {
  const checklist: PlatformPublishGuardChecklistItem[] = [];

  const platformValid = isSocialPlatform(post.platform);
  checklist.push(
    item("platform_valid", "platform 유효성", platformValid ? "pass" : "blocked", platformValid ? "지원하는 platform입니다." : `지원하지 않는 platform입니다: ${post.platform}`)
  );

  const toneValid = isToneStyle(post.toneStyle);
  checklist.push(
    item("tone_style_valid", "tone_style 유효성", toneValid ? "pass" : "blocked", toneValid ? "지원하는 tone_style입니다." : `지원하지 않는 tone_style입니다: ${post.toneStyle}`)
  );

  checklist.push(
    item(
      "quality_status_ready",
      "quality_status가 ready",
      post.qualityStatus === "ready" ? "pass" : "blocked",
      post.qualityStatus === "ready" ? "quality_status가 ready입니다." : `quality_status가 ready가 아닙니다(${post.qualityStatus}).`
    )
  );

  checklist.push(
    item(
      "approval_status_approved",
      "approval_status가 approved",
      post.approvalStatus === "approved" ? "pass" : "blocked",
      post.approvalStatus === "approved" ? "approval_status가 approved입니다." : `approval_status가 approved가 아닙니다(${post.approvalStatus}).`
    )
  );

  const exportOk = post.exportStatus === "ready" || post.exportStatus === "exported";
  checklist.push(
    item(
      "export_status_ready_or_exported",
      "export_status가 ready/exported",
      exportOk ? "pass" : "blocked",
      exportOk ? "export_status가 ready 또는 exported입니다." : `export_status가 ready/exported가 아닙니다(${post.exportStatus}).`
    )
  );

  const publishOk = !["blocked", "published", "failed"].includes(post.publishStatus);
  checklist.push(
    item(
      "publish_status_ok",
      "publish_status가 blocked/published/failed가 아님",
      publishOk ? "pass" : "blocked",
      publishOk ? "publish_status가 게시 가능한 상태입니다." : `publish_status가 게시를 막는 상태입니다(${post.publishStatus}).`
    )
  );

  const contentPresent = hasAnyContent(post);
  checklist.push(
    item("content_present", "콘텐츠 존재", contentPresent ? "pass" : "blocked", contentPresent ? "게시할 콘텐츠가 있습니다." : "게시할 콘텐츠가 없습니다.")
  );

  const exportPayloadPresent = Object.keys(post.exportPayload ?? {}).length > 0;
  checklist.push(
    item(
      "export_payload_present",
      "export_payload 존재",
      exportPayloadPresent ? "pass" : "blocked",
      exportPayloadPresent ? "export_payload가 준비되어 있습니다." : "export_payload가 비어 있습니다."
    )
  );

  const forbidden = checkForbiddenPatterns(collectText(post));
  checklist.push(
    item(
      "no_forbidden_patterns",
      "금지 표현 없음",
      forbidden.blocked ? "blocked" : "pass",
      forbidden.blocked ? `금지 표현이 발견되었습니다: ${forbidden.found.join(", ")}` : "금지 표현이 발견되지 않았습니다."
    )
  );

  if (platformValid) {
    const risks = checkPlatformSpecificRisks(post);
    checklist.push(
      item(
        "platform_specific_risk",
        "플랫폼별 위험 신호 없음",
        risks.length > 0 ? "blocked" : "pass",
        risks.length > 0 ? risks.join(" / ") : "플랫폼별 위험 신호가 발견되지 않았습니다."
      )
    );

    const primaryFieldOk = hasPlatformPrimaryField(post, post.platform as SocialPlatform);
    checklist.push(
      item(
        "platform_primary_field_present",
        "플랫폼 필수 필드 존재",
        primaryFieldOk ? "pass" : "blocked",
        primaryFieldOk
          ? "플랫폼이 요구하는 필수 필드가 채워져 있습니다."
          : `${describePlatformPrimaryField(post.platform as SocialPlatform)}이(가) 비어 있어 게시할 수 없습니다.`
      )
    );
  }

  return checklist;
}

/** 플랫폼별로 반드시 있어야 하는 핵심 필드가 채워져 있는지 확인한다. */
function hasPlatformPrimaryField(post: SocialPost, platform: SocialPlatform): boolean {
  switch (platform) {
    case "wordpress_blog":
    case "naver_blog":
    case "naver_cafe":
      return Boolean(post.postTitle?.trim() && post.postBody?.trim());
    case "x":
      return post.threadItems.length > 0 && post.threadItems.some((t) => t.text.trim().length > 0);
    case "threads":
      return Boolean(post.postBody?.trim());
    case "instagram":
      return Boolean(post.caption?.trim());
    default:
      return true;
  }
}

function describePlatformPrimaryField(platform: SocialPlatform): string {
  switch (platform) {
    case "wordpress_blog":
    case "naver_blog":
    case "naver_cafe":
      return "post_title/post_body";
    case "x":
      return "thread_items";
    case "threads":
      return "post_body";
    case "instagram":
      return "caption";
    default:
      return "필수 필드";
  }
}

/** 플랫폼별 needs_revision 수준의 soft 체크리스트를 만든다 (hard gate를 통과했을 때만 의미가 있음). */
function buildPlatformSoftChecklist(post: SocialPost, platform: SocialPlatform): PlatformPublishGuardChecklistItem[] {
  const config = getPlatformWritingConfig(platform);
  const checklist: PlatformPublishGuardChecklistItem[] = [];
  const looksLikeMock = (collectText(post).match(/\[mock\]|\[placeholder\]/g) ?? []).length > 0;

  switch (platform) {
    case "wordpress_blog": {
      const titleBodyOk = Boolean(post.postTitle?.trim() && post.postBody?.trim());
      checklist.push(item("wordpress_title_body_present", "title/body 존재", titleBodyOk ? "pass" : "warning", titleBodyOk ? "title/body가 모두 있습니다." : "title 또는 body가 비어 있습니다."));
      checklist.push(item("wordpress_excerpt_present", "excerpt 존재 (가산)", post.excerpt?.trim() ? "pass" : "warning", post.excerpt?.trim() ? "excerpt가 있습니다." : "excerpt가 없습니다."));
      const bodyLen = post.postBody?.length ?? 0;
      checklist.push(item("wordpress_body_length", "본문 길이", bodyLen >= config.minLength ? "pass" : "warning", bodyLen >= config.minLength ? "본문 길이가 충분합니다." : `본문이 권장 길이(${config.minLength}자)보다 짧습니다.`));
      const titleTooGeneric = (post.postTitle?.trim().length ?? 0) < 8;
      checklist.push(item("wordpress_title_specificity", "title 구체성", titleTooGeneric ? "warning" : "pass", titleTooGeneric ? "title이 너무 일반적이거나 짧습니다." : "title이 충분히 구체적입니다."));
      break;
    }
    case "naver_blog": {
      const titleBodyOk = Boolean(post.postTitle?.trim() && post.postBody?.trim());
      checklist.push(item("naver_blog_title_body_present", "title/body 존재", titleBodyOk ? "pass" : "warning", titleBodyOk ? "title/body가 모두 있습니다." : "title 또는 body가 비어 있습니다."));
      checklist.push(item("naver_blog_hashtag_present", "해시태그 존재", post.hashtags.length > 0 ? "pass" : "warning", post.hashtags.length > 0 ? "해시태그가 있습니다." : "해시태그가 없습니다."));
      const titleSearchy = (post.postTitle?.trim().length ?? 0) >= 10;
      checklist.push(item("naver_blog_title_search_friendly", "검색형 제목", titleSearchy ? "pass" : "warning", titleSearchy ? "검색에 유리한 제목입니다." : "제목이 너무 짧아 검색형 제목이 아닐 수 있습니다."));
      checklist.push(item("naver_blog_mock_artifact", "AI/placeholder 흔적 없음", looksLikeMock ? "warning" : "pass", looksLikeMock ? "[mock]/[placeholder] 표시가 남아 있습니다." : "AI/placeholder 흔적이 없습니다."));
      break;
    }
    case "naver_cafe": {
      const titleBodyOk = Boolean(post.postTitle?.trim() && post.postBody?.trim());
      checklist.push(item("naver_cafe_title_body_present", "title/body 존재", titleBodyOk ? "pass" : "warning", titleBodyOk ? "title/body가 모두 있습니다." : "title 또는 body가 비어 있습니다."));
      const hasDiscussionCue = /[?？]|어떻게 생각|계신가요|공유해|추천해/.test(collectText(post));
      checklist.push(item("naver_cafe_discussion_cue", "질문/토론 유도 문장", hasDiscussionCue ? "pass" : "warning", hasDiscussionCue ? "질문/토론 유도 문장이 있습니다." : "질문/토론을 유도하는 문장이 부족합니다."));
      const linkCount = (post.postBody?.match(/https?:\/\//g) ?? []).length;
      checklist.push(item("naver_cafe_link_overuse", "링크 남발 없음", linkCount <= 2 ? "pass" : "warning", linkCount <= 2 ? "링크 사용이 적절합니다." : `링크가 ${linkCount}개로 과도할 수 있습니다.`));
      break;
    }
    case "x": {
      const items = post.threadItems;
      checklist.push(item("x_thread_items_present", "thread_items 존재", items.length > 0 ? "pass" : "warning", items.length > 0 ? "thread_items가 있습니다." : "thread_items가 없습니다."));
      const overLength = items.filter((t) => t.text.length > X_MAX_ITEM_LENGTH);
      checklist.push(item("x_thread_item_length", "thread item 길이 제한", overLength.length > 0 ? "fail" : "pass", overLength.length > 0 ? `${overLength.length}개의 thread item이 ${X_MAX_ITEM_LENGTH}자를 초과했습니다.` : "모든 thread item이 길이 제한 이내입니다."));
      const hookWeak = items.length > 0 && items[0].text.trim().length < 10;
      checklist.push(item("x_hook_present", "첫 item hook", hookWeak ? "warning" : "pass", hookWeak ? "첫 item의 hook이 약합니다." : "첫 item에 hook이 있습니다."));
      if (items.length > 7) {
        checklist.push(item("x_thread_item_count", "thread item 개수", "warning", `thread item이 ${items.length}개로 너무 많습니다.`));
      }
      if (post.hashtags.length > 3) {
        checklist.push(item("x_hashtag_excess", "해시태그 과다 없음", "warning", `해시태그가 ${post.hashtags.length}개로 과다할 수 있습니다.`));
      }
      break;
    }
    case "threads": {
      checklist.push(item("threads_body_present", "post_body 존재", post.postBody?.trim() ? "pass" : "warning", post.postBody?.trim() ? "post_body가 있습니다." : "post_body가 비어 있습니다."));
      const bodyLen = post.postBody?.length ?? 0;
      checklist.push(item("threads_length", "너무 길지 않음", bodyLen <= config.maxLength ? "pass" : "warning", bodyLen <= config.maxLength ? "길이가 적절합니다." : `길이(${bodyLen}자)가 권장 최대(${config.maxLength}자)를 초과했습니다.`));
      const conversational = /[?？]/.test(post.postBody ?? "");
      checklist.push(item("threads_conversational", "대화형/질문/인사이트 포함", conversational ? "pass" : "warning", conversational ? "질문 또는 대화형 요소가 있습니다." : "질문/인사이트 등 대화형 요소가 부족합니다."));
      break;
    }
    case "instagram": {
      checklist.push(item("instagram_caption_present", "caption 존재", post.caption?.trim() ? "pass" : "warning", post.caption?.trim() ? "caption이 있습니다." : "caption이 비어 있습니다."));
      checklist.push(item("instagram_hashtags_present", "해시태그 존재", post.hashtags.length > 0 ? "pass" : "warning", post.hashtags.length > 0 ? "해시태그가 있습니다." : "해시태그가 없습니다."));
      const mediaDeclared = post.cardItems.length > 0 || post.mediaRequirements?.requiresImage === true;
      checklist.push(item("instagram_media_declared", "이미지/카드뉴스 필요성 명시", mediaDeclared ? "pass" : "warning", mediaDeclared ? "card_items 또는 media_requirements가 준비되어 있습니다." : "card_items도 없고 media_requirements.requiresImage도 명시되어 있지 않습니다."));
      const captionLen = post.caption?.length ?? 0;
      checklist.push(item("instagram_caption_length", "caption 길이", captionLen >= config.minLength && captionLen <= config.maxLength ? "pass" : "warning", captionLen >= config.minLength && captionLen <= config.maxLength ? "caption 길이가 적절합니다." : "caption이 너무 짧거나 깁니다."));
      break;
    }
    default:
      break;
  }

  return checklist;
}

/**
 * social post 하나에 대해 플랫폼별 게시 가능 조건(publishing guard)을
 * 검사한다. 실제 게시는 어떤 경우에도 수행하지 않으며, 통과(ready)해도
 * publish_status는 바뀌지 않는다.
 */
export async function runPlatformPublishingGuard(socialPostId: string): Promise<{
  success: boolean;
  message: string;
  result?: PlatformPublishGuardResult;
}> {
  const existing = await getSocialPostForPublishingGuard(socialPostId);
  if (!existing) {
    return { success: false, message: `social post를 찾을 수 없습니다: ${socialPostId}` };
  }

  await logGuardEvent(
    "social_platform_publish_guard_started",
    "info",
    `social post(${socialPostId})의 platform publishing guard를 시작합니다.`,
    existing.articleId,
    { socialPostId, platform: existing.platform, qualityStatus: existing.qualityStatus, approvalStatus: existing.approvalStatus, exportStatus: existing.exportStatus, publishStatus: existing.publishStatus }
  );

  try {
    const gateChecklist = buildCommonGateChecklist(existing);
    const blockedItems = gateChecklist.filter((c) => c.status === "blocked");

    let checklist = gateChecklist;
    let result: PlatformPublishGuardResult;

    if (blockedItems.length > 0) {
      const score = calculatePublishingGuardScore(checklist);
      result = {
        status: "blocked",
        score,
        ready: false,
        blockedReason: blockedItems[0].message,
        checklist,
        warnings: [],
        failures: [],
        blockedReasons: blockedItems.map((c) => c.message),
      };
    } else {
      const softChecklist = isSocialPlatform(existing.platform) ? buildPlatformSoftChecklist(existing, existing.platform) : [];
      checklist = [...gateChecklist, ...softChecklist];
      const failedItems = checklist.filter((c) => c.status === "fail");
      const warningItems = checklist.filter((c) => c.status === "warning");
      const score = calculatePublishingGuardScore(checklist);
      const status = failedItems.length > 0 || score < READY_SCORE_THRESHOLD ? "needs_revision" : "ready";

      result = {
        status,
        score,
        ready: status === "ready",
        checklist,
        warnings: warningItems.map((c) => c.message),
        failures: failedItems.map((c) => c.message),
        blockedReasons: [],
      };
    }

    await updatePlatformPublishGuardResult(socialPostId, result);

    const eventType: LogEventType =
      result.status === "blocked"
        ? "social_platform_publish_guard_blocked"
        : result.status === "needs_revision"
          ? "social_platform_publish_guard_needs_revision"
          : "social_platform_publish_guard_completed";
    const logStatus: LogStatus = result.status === "blocked" ? "failed" : "success";

    await logGuardEvent(
      eventType,
      logStatus,
      `social post(${socialPostId})의 platform publishing guard가 완료되었습니다 (status: ${result.status}, score: ${result.score}, ready: ${result.ready}).`,
      existing.articleId,
      {
        socialPostId,
        platform: existing.platform,
        toneStyle: existing.toneStyle,
        qualityStatus: existing.qualityStatus,
        approvalStatus: existing.approvalStatus,
        exportStatus: existing.exportStatus,
        publishStatus: existing.publishStatus,
        guardStatus: result.status,
        guardScore: result.score,
        ready: result.ready,
        warningCount: result.warnings.length,
        failureCount: result.failures.length,
        blockedCount: result.blockedReasons.length,
        hashtagCount: existing.hashtags.length,
        threadItemCount: existing.threadItems.length,
        cardItemCount: existing.cardItems.length,
        postBodyLength: existing.postBody?.length ?? 0,
        captionLength: existing.caption?.length ?? 0,
      }
    );

    return {
      success: true,
      message: `platform publishing guard 실행 완료 (status: ${result.status}, ready: ${result.ready}).`,
      result,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    await markPlatformPublishGuardFailed(socialPostId, message).catch(() => undefined);
    await logGuardEvent(
      "social_platform_publish_guard_failed",
      "failed",
      `platform publishing guard 실행 실패: ${message}`,
      existing.articleId,
      { socialPostId, platform: existing.platform }
    );
    return { success: false, message };
  }
}
