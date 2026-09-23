// Phase 4-22: 자동 검토(quality gate)에서 발견된 문제 중 AI/시스템이
// 사용자에게 묻지 않고 안전하게 고칠 수 있는 항목(auto_fixable +
// canAutoFix=true)만 자동으로 정리하고, 반드시 자동 재검토까지 실행한
// 뒤 최종 상태(승인 가능/확인 필요/승인 불가)를 계산하는 오케스트레이션.
//
// 새로운 AI 재작성 호출은 추가하지 않는다 — 지금 구현된 자동 수정은
// 전부 이미 검증된 결정론적 sanitizer(sanitizeInternalSectionHeadings,
// sanitizeNaverCafePlainText)를 재사용한다. "리드문 보강"/"문장
// 다듬기"처럼 실제 문장을 새로 작성해야 하는 교정은 새로운 AI 호출과
// 환각(hallucination) 방지 장치가 필요해 이번 범위에 포함하지 않았다
// (canAutoFix=false로 분류되어 사용자가 "본문 수정"으로 직접 고친다 —
// docs/phase-4-22-auto-fix-and-recheck.md 참고).
//
// 원칙: 자동 수정 = 시스템, 자동 재검토 = 시스템, 최종 승인 = 사용자.
// 이 함수는 approval_status를 절대 바꾸지 않는다.

import { getSocialPostById } from "@/lib/repositories/social-posts-repository";
import { editSocialPostContent, runSocialPostQualityGateAndSave } from "./social-post-service";
import type { EditSocialPostInput } from "./social-post-service";
import { sanitizeInternalSectionHeadings } from "./internal-section-heading-sanitizer";
import { sanitizeNaverCafePlainText } from "./naver-cafe-plain-text-sanitizer";
import { sanitizePlainTextMarkupResidue } from "./plain-text-markup-residue-sanitizer";
import { classifyReviewIssues, summarizeReviewIssues, type ClassifiedReviewIssue } from "./review-issue-fixability";
import { logEvent } from "@/lib/harness/logger";
import type { SocialPost, SocialPostQualityChecklistItem } from "./social-platform-types";

/** post.qualitySummary.checklist(Record<string, unknown>)를 안전하게 배열로 꺼낸다. */
function extractChecklist(qualitySummary: Record<string, unknown>): SocialPostQualityChecklistItem[] {
  const checklist = qualitySummary.checklist;
  if (!Array.isArray(checklist)) return [];
  return checklist.filter(
    (item): item is SocialPostQualityChecklistItem =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as { key?: unknown }).key === "string" &&
      typeof (item as { status?: unknown }).status === "string"
  );
}

export type PostAutoFixFinalState = "approvable" | "user_confirmation_required" | "blocked";

export interface AutoFixAndRecheckResult {
  success: boolean;
  message: string;
  /** 사용자에게 보여줄 "무엇을 정리했는지" 한국어 요약 문장 목록(전체 본문은 담지 않는다). */
  changesApplied: string[];
  /** 자동 수정 대상이 하나도 없었으면 true(재검토는 그래도 실행된다). */
  noSafeChangesFound: boolean;
  finalState: PostAutoFixFinalState;
  remainingUserConfirmationIssues: ClassifiedReviewIssue[];
  remainingBlockingIssues: ClassifiedReviewIssue[];
  socialPost?: SocialPost;
}

async function logAutoFixEvent(
  type:
    | "post_auto_fix_started"
    | "post_review_issues_classified"
    | "post_auto_fixable_issues_found"
    | "post_user_confirmation_issues_found"
    | "post_blocking_issues_found"
    | "post_auto_fix_completed"
    | "post_auto_fix_failed"
    | "post_auto_recheck_started"
    | "post_auto_recheck_completed"
    | "post_auto_recheck_failed"
    | "post_auto_fix_partial_success"
    | "post_auto_fix_no_safe_changes",
  status: "info" | "success" | "failed",
  message: string,
  articleId: string,
  details: Record<string, unknown>
): Promise<void> {
  // full body/prompt/AI 응답은 절대 담지 않는다 — count/status 등 메타데이터만 남긴다.
  await logEvent({ type, status, message, articleId, targetType: "article", targetId: articleId, details });
}

/** 남은 issue 상태로부터 최종 상태(승인 가능/확인 필요/승인 불가)를 계산한다. */
function computeFinalState(classified: ClassifiedReviewIssue[]): PostAutoFixFinalState {
  const problems = classified.filter((item) => item.status !== "pass");
  if (problems.some((item) => item.fixability === "blocking")) return "blocked";
  if (problems.some((item) => item.fixability !== "auto_fixable" || !item.canAutoFix)) return "user_confirmation_required";
  return "approvable";
}

/**
 * 게시용 본문에 실제로 구현된 결정론적 sanitizer를 적용한다. 어떤
 * sanitizer가 실제로 뭔가 바꿨을 때만 changesApplied에 사용자 친화적
 * 문장을 추가한다. 사실/수치/기관명/날짜는 전혀 건드리지 않는다 —
 * 소제목/형식만 정리한다.
 *
 * Phase UX-05A: x(threadItems)/threads(postBody)/instagram(caption+
 * cardItems)의 markdown/HTML 잔여물도 여기서 함께 정리한다
 * (plain-text-markup-residue-sanitizer.ts) — naver_cafe와 같은 원칙
 * (결정론적 변환, 새 AI 호출 없음)이며, 바뀐 필드만 반환 객체에
 * 담는다(바뀌지 않은 필드는 아예 넣지 않아 editSocialPostContent가
 * 불필요하게 덮어쓰지 않게 한다).
 */
function applyImplementedAutoFixers(post: SocialPost): { edits: Partial<EditSocialPostInput>; changesApplied: string[] } {
  const changesApplied: string[] = [];
  const edits: Partial<EditSocialPostInput> = {};
  let body = post.postBody;

  const headingResult = sanitizeInternalSectionHeadings(body);
  if (headingResult.changed) {
    body = headingResult.body;
    changesApplied.push("내부 작성용 소제목(리드문/본문/배경 설명 등)을 독자용 소제목으로 정리했습니다.");
  }

  if (post.platform === "naver_cafe") {
    const plainTextBody = sanitizeNaverCafePlainText(body);
    if (plainTextBody !== body) {
      body = plainTextBody || null;
      changesApplied.push("남아 있던 markdown 기호를 정리해 plain text로 맞췄습니다.");
    }
  }

  if (post.platform === "threads") {
    const sanitizedBody = sanitizePlainTextMarkupResidue(body);
    if (sanitizedBody !== (body ?? "")) {
      body = sanitizedBody || null;
      changesApplied.push("남아 있던 markdown/HTML 잔여물을 정리했습니다.");
    }
  }

  if (body !== post.postBody) {
    edits.postBody = body;
  }

  if (post.platform === "x" && post.threadItems.length > 0) {
    const sanitizedItems = post.threadItems.map((item) => ({ ...item, text: sanitizePlainTextMarkupResidue(item.text) }));
    const threadChanged = sanitizedItems.some((item, i) => item.text !== post.threadItems[i].text);
    if (threadChanged) {
      edits.threadItems = sanitizedItems;
      changesApplied.push("thread item에 남아 있던 markdown/HTML 잔여물을 정리했습니다.");
    }
  }

  if (post.platform === "instagram") {
    if (post.caption) {
      const sanitizedCaption = sanitizePlainTextMarkupResidue(post.caption);
      if (sanitizedCaption !== post.caption) {
        edits.caption = sanitizedCaption || null;
        changesApplied.push("caption에 남아 있던 markdown/HTML 잔여물을 정리했습니다.");
      }
    }
    if (post.cardItems.length > 0) {
      const sanitizedCards = post.cardItems.map((item) => ({
        ...item,
        heading: sanitizePlainTextMarkupResidue(item.heading),
        body: sanitizePlainTextMarkupResidue(item.body),
      }));
      const cardsChanged = sanitizedCards.some(
        (item, i) => item.heading !== post.cardItems[i].heading || item.body !== post.cardItems[i].body
      );
      if (cardsChanged) {
        edits.cardItems = sanitizedCards;
        changesApplied.push("card item에 남아 있던 markdown/HTML 잔여물을 정리했습니다.");
      }
    }
  }

  return { edits, changesApplied };
}

/**
 * 최신 자동 검토 결과를 불러와 issue를 분류하고, 실제 자동 수정기가
 * 있는 문제만 정리한 뒤 자동 재검토를 실행한다. 자동 수정 대상이
 * 없어도 재검토는 항상 실행한다(현재 상태를 최신으로 반영하기
 * 위해서). approval_status는 절대 바꾸지 않는다 — 승인은 이 함수를
 * 호출한 쪽(예: [저장 후 승인] action)이 별도로 처리한다.
 */
export async function runAutoFixAndRecheck(socialPostId: string): Promise<AutoFixAndRecheckResult> {
  const post = await getSocialPostById(socialPostId);
  if (!post) {
    return {
      success: false,
      message: `social post를 찾을 수 없습니다: ${socialPostId}`,
      changesApplied: [],
      noSafeChangesFound: true,
      finalState: "blocked",
      remainingUserConfirmationIssues: [],
      remainingBlockingIssues: [],
    };
  }

  const checklist = extractChecklist(post.qualitySummary ?? {});
  const classified = classifyReviewIssues(checklist);
  const summary = summarizeReviewIssues(checklist);

  await logAutoFixEvent("post_auto_fix_started", "info", "자동 수정 파이프라인을 시작합니다.", post.articleId, {
    socialPostId,
    platform: post.platform,
    autoFixableCount: summary.autoFixable.length,
    userConfirmationCount: summary.userConfirmationRequired.length,
    blockingCount: summary.blocking.length,
  });
  await logAutoFixEvent(
    "post_review_issues_classified",
    "info",
    "검토 issue를 분류했습니다.",
    post.articleId,
    { socialPostId, issueCount: classified.filter((i) => i.status !== "pass").length }
  );
  if (summary.autoFixable.length > 0) {
    await logAutoFixEvent("post_auto_fixable_issues_found", "info", "자동 수정 가능한 issue를 발견했습니다.", post.articleId, {
      socialPostId,
      keys: summary.autoFixable.map((i) => i.key),
    });
  }
  if (summary.userConfirmationRequired.length > 0) {
    await logAutoFixEvent(
      "post_user_confirmation_issues_found",
      "info",
      "사용자 확인이 필요한 issue를 발견했습니다.",
      post.articleId,
      { socialPostId, keys: summary.userConfirmationRequired.map((i) => i.key) }
    );
  }
  if (summary.blocking.length > 0) {
    await logAutoFixEvent("post_blocking_issues_found", "info", "승인을 막는 issue를 발견했습니다.", post.articleId, {
      socialPostId,
      keys: summary.blocking.map((i) => i.key),
    });
  }

  const implementedAutoFixIssues = summary.autoFixable.filter((i) => i.canAutoFix);
  let changesApplied: string[] = [];
  let latestPost = post;

  if (implementedAutoFixIssues.length > 0) {
    const { edits, changesApplied: applied } = applyImplementedAutoFixers(post);
    if (applied.length > 0) {
      const editResult = await editSocialPostContent(socialPostId, { ...edits, editedBy: "system:auto_fix" });
      if (!editResult.success || !editResult.socialPost) {
        await logAutoFixEvent("post_auto_fix_failed", "failed", editResult.message, post.articleId, { socialPostId });
        return {
          success: false,
          message: `자동 수정 내용을 저장하지 못했습니다: ${editResult.message}`,
          changesApplied: [],
          noSafeChangesFound: false,
          finalState: "user_confirmation_required",
          remainingUserConfirmationIssues: summary.userConfirmationRequired,
          remainingBlockingIssues: summary.blocking,
        };
      }
      changesApplied = applied;
      latestPost = editResult.socialPost;
      await logAutoFixEvent("post_auto_fix_completed", "success", "자동 수정을 완료했습니다.", post.articleId, {
        socialPostId,
        changeCount: applied.length,
      });
    } else {
      await logAutoFixEvent(
        "post_auto_fix_no_safe_changes",
        "info",
        "자동 수정 대상으로 분류됐지만 실제로 바뀔 내용이 없었습니다.",
        post.articleId,
        { socialPostId }
      );
    }
  }

  await logAutoFixEvent("post_auto_recheck_started", "info", "자동 재검토를 시작합니다.", post.articleId, { socialPostId });
  const recheckResult = await runSocialPostQualityGateAndSave(socialPostId);
  if (!recheckResult.success || !recheckResult.socialPost) {
    await logAutoFixEvent("post_auto_recheck_failed", "failed", recheckResult.message, post.articleId, { socialPostId });
    return {
      success: false,
      message: "자동 수정 후 재검토를 실행하지 못했습니다.",
      changesApplied,
      noSafeChangesFound: changesApplied.length === 0,
      finalState: "user_confirmation_required",
      remainingUserConfirmationIssues: summary.userConfirmationRequired,
      remainingBlockingIssues: summary.blocking,
      socialPost: latestPost,
    };
  }

  const recheckedPost = recheckResult.socialPost;
  const recheckedChecklist = extractChecklist(recheckedPost.qualitySummary ?? {});
  const recheckedClassified = classifyReviewIssues(recheckedChecklist);
  const finalState = computeFinalState(recheckedClassified);
  const remainingUserConfirmationIssues = recheckedClassified.filter(
    (i) => i.status !== "pass" && i.fixability === "user_confirmation_required"
  );
  const remainingBlockingIssues = recheckedClassified.filter((i) => i.status !== "pass" && i.fixability === "blocking");

  // OPS-02B: 재검토 실행 자체는 성공했다 — finalState가 blocked여도
  // "실행 실패"가 아니다(QA-01-FIX1과 동일 원칙).
  await logAutoFixEvent(
    "post_auto_recheck_completed",
    "success",
    `자동 재검토를 완료했습니다 (finalState: ${finalState}).`,
    post.articleId,
    { socialPostId, finalState, remainingUserConfirmationCount: remainingUserConfirmationIssues.length, remainingBlockingCount: remainingBlockingIssues.length }
  );

  if (changesApplied.length > 0 && finalState !== "approvable") {
    await logAutoFixEvent(
      "post_auto_fix_partial_success",
      "info",
      "일부는 자동으로 정리했지만 여전히 남은 문제가 있습니다.",
      post.articleId,
      { socialPostId, finalState }
    );
  }

  const message =
    changesApplied.length === 0
      ? finalState === "approvable"
        ? "자동 수정할 항목이 없었고, 자동 검토도 통과했습니다."
        : "자동 수정할 항목이 없었습니다. 남은 문제를 확인해 주세요."
      : finalState === "approvable"
        ? "게시용 본문을 자동 정리했습니다. 자동 재검토를 통과해 승인할 수 있습니다."
        : finalState === "user_confirmation_required"
          ? "게시용 본문을 자동 정리했습니다. 다만 확인이 필요한 항목이 남아 있습니다."
          : "게시용 본문을 자동 정리했지만, 게시할 수 없는 문제가 남아 있습니다.";

  return {
    success: true,
    message,
    changesApplied,
    noSafeChangesFound: changesApplied.length === 0,
    finalState,
    remainingUserConfirmationIssues,
    remainingBlockingIssues,
    socialPost: recheckedPost,
  };
}
