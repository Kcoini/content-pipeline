// Phase 3-25: "글 생성 후 검토" 프로세스를 "사람이 모든 항목을 직접
// 검사"에서 "시스템이 먼저 자동 검토하고, 사람은 검토 리포트와 게시용
// 본문을 확인한 뒤 최종 승인"으로 바꾸기 위한 표시 계층.
//
// 새 검사 엔진을 만들지 않는다 — 이미 있는
// `lib/social/social-quality-gate.ts`(runSocialPostQualityGate)가 구조/
// 출처/플랫폼 적합성/문체/안전성 검사를 폭넓게 수행하고 있고, 그 결과
// (SocialPostQualityChecklistItem[])는 이미 `social_posts.quality_summary
// .checklist`에 저장되어 있다(updateSocialPostQuality). 이 파일은 그
// 결과를 "통과/확인 필요/수정 필요/차단" 4단계 사용자 친화적 리포트로
// 다시 묶어서 보여주는 순수 함수만 담당한다 — DB 스키마 변경도, 새
// 저장소도 필요 없다(리포트는 항상 현재 checklist로부터 다시 계산한다).
//
// 자동 검토는 사람의 최종 승인을 대체하지 않는다 — 이 리포트가
// "승인 가능"이라고 표시해도, 실제 승인 여부는 여전히 사람이 누르는
// [최종 승인] 버튼(`lib/social/social-post-approval-service.ts`)에
// 달려 있다.

import type { SocialPostQualityChecklistItem } from "./social-platform-types";
import { describeStatusValue } from "./status-labels";

export type AutoReviewOverallStatus = "passed" | "needs_check" | "needs_fix" | "blocked";

export type AutoReviewAxis = "structure" | "source" | "platform_fit" | "tone" | "safety" | "publish_readiness";

const AXIS_LABELS: Record<AutoReviewAxis, string> = {
  structure: "구조",
  source: "출처",
  platform_fit: "플랫폼 적합성",
  tone: "문체/톤",
  safety: "안전성",
  publish_readiness: "게시 준비",
};

/**
 * checklist item.key → 검토 축 매핑. `runSocialPostQualityGate`가 실제로
 * 만드는 key와 정확히 일치해야 한다(새 key가 생기면 여기에도 추가한다 —
 * 매핑에 없는 key는 안전하게 "structure"로 취급한다).
 */
const AXIS_BY_KEY: Record<string, AutoReviewAxis> = {
  platform_valid: "platform_fit",
  tone_style_valid: "platform_fit",
  content_present: "structure",
  required_fields_present: "structure",
  length_check: "structure",
  hashtag_check: "structure",
  instagram_card_items: "structure",
  instagram_media_requirements: "structure",
  x_thread_item_count: "structure",
  x_thread_item_length: "structure",
  wordpress_excerpt_present: "structure",
  wordpress_blog_heading_structure: "structure",
  wordpress_blog_summary_box_present: "structure",
  wordpress_blog_table_present: "structure",
  wordpress_blog_checklist_present: "structure",
  wordpress_blog_faq_present: "structure",
  wordpress_blog_body_depth: "structure",
  wordpress_blog_source_date_notice_present: "source",
  wordpress_blog_single_source_notice: "source",
  wordpress_blog_single_source_verification_needed_section: "source",
  no_raw_content_copy_suspected: "source",
  naver_cafe_no_markdown_escape: "platform_fit",
  naver_cafe_no_localhost_link: "safety",
  naver_blog_keyword_repetition: "platform_fit",
  tone_alignment_check: "tone",
  wordpress_blog_non_generic_opening: "tone",
  wordpress_blog_early_direct_answer: "tone",
  wordpress_blog_no_fearmongering: "tone",
  wordpress_blog_no_unsupported_authority: "tone",
  wordpress_blog_no_ai_exposure_guarantee: "tone",
  wordpress_blog_no_slash_joined_points: "tone",
  naver_cafe_discussion_cue: "tone",
  naver_cafe_promotional_language: "tone",
  no_threat_language: "safety",
  no_ad_click_bait: "safety",
  no_income_guarantee: "safety",
  no_pii_exposure: "safety",
  naver_cafe_no_internal_status_leak: "safety",
  // Phase 4-3: news_article(언론 기사).
  news_article_lead_present: "structure",
  news_article_no_unsourced_claim: "source",
};

function resolveAxis(key: string): AutoReviewAxis {
  return AXIS_BY_KEY[key] ?? "structure";
}

export interface AutoReviewIssue {
  key: string;
  axis: AutoReviewAxis;
  axisLabel: string;
  /** "needs_check"(확인 필요) / "needs_fix"(수정 필요) / "blocked"(차단) — "통과"는 이슈 목록에 넣지 않는다. */
  severity: "needs_check" | "needs_fix" | "blocked";
  message: string;
  /**
   * "문제 아님으로 표시"를 허용할지. blocked 항목(개인정보/허위/위험
   * 표현/광고 클릭 유도 등)은 절대 허용하지 않는다 — needs_check(확인
   * 필요) 수준의 false positive에만 허용한다.
   */
  canDismiss: boolean;
}

export interface AutoReviewSummary {
  overallStatus: AutoReviewOverallStatus;
  overallLabel: string;
  riskLevel: "low" | "medium" | "high";
  counts: { passed: number; needsCheck: number; needsFix: number; blocked: number };
  /** 통과 항목 설명(사용자 친화적 문장). */
  passedMessages: string[];
  /** 확인 필요/수정 필요/차단 항목만(통과 제외), severity 우선순위(차단 > 수정 필요 > 확인 필요) 순으로 정렬. */
  issues: AutoReviewIssue[];
}

const SEVERITY_ORDER: Record<AutoReviewIssue["severity"], number> = {
  blocked: 0,
  needs_fix: 1,
  needs_check: 2,
};

const OVERALL_LABELS: Record<AutoReviewOverallStatus, string> = {
  passed: "자동 검토 완료 · 통과",
  needs_check: "자동 검토 완료 · 확인 필요",
  needs_fix: "자동 검토 완료 · 수정 필요",
  blocked: "자동 검토 완료 · 차단됨",
};

/**
 * quality gate checklist를 사용자 친화적인 "자동 검토 리포트"로 바꾼다.
 * DB에 아무것도 쓰지 않는다 — 항상 주어진 checklist로부터 다시 계산되는
 * 순수 함수다(검토 결과를 별도로 저장할 필요가 없다).
 */
export function summarizeAutoReview(
  checklist: readonly Pick<SocialPostQualityChecklistItem, "key" | "status" | "message">[] | null | undefined
): AutoReviewSummary {
  const items = checklist ?? [];

  const passedMessages: string[] = [];
  const issues: AutoReviewIssue[] = [];

  for (const item of items) {
    const axis = resolveAxis(item.key);
    const axisLabel = AXIS_LABELS[axis];

    if (item.status === "pass") {
      passedMessages.push(item.message);
      continue;
    }

    const severity: AutoReviewIssue["severity"] =
      item.status === "blocked" ? "blocked" : item.status === "fail" ? "needs_fix" : "needs_check";

    issues.push({
      key: item.key,
      axis,
      axisLabel,
      severity,
      message: item.message,
      // blocked/needs_fix(안전성·구조상 실제 문제)는 "문제 아님"으로
      // 우회할 수 없다 — needs_check(확인 필요) 수준만 허용한다.
      canDismiss: severity === "needs_check",
    });
  }

  issues.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const counts = {
    passed: passedMessages.length,
    needsCheck: issues.filter((i) => i.severity === "needs_check").length,
    needsFix: issues.filter((i) => i.severity === "needs_fix").length,
    blocked: issues.filter((i) => i.severity === "blocked").length,
  };

  let overallStatus: AutoReviewOverallStatus;
  let riskLevel: AutoReviewSummary["riskLevel"];
  if (counts.blocked > 0) {
    overallStatus = "blocked";
    riskLevel = "high";
  } else if (counts.needsFix > 0) {
    overallStatus = "needs_fix";
    riskLevel = "medium";
  } else if (counts.needsCheck > 0) {
    overallStatus = "needs_check";
    riskLevel = "low";
  } else {
    overallStatus = "passed";
    riskLevel = "low";
  }

  return {
    overallStatus,
    overallLabel: OVERALL_LABELS[overallStatus],
    riskLevel,
    counts,
    passedMessages,
    issues,
  };
}

/** 위험도 값을 한국어 라벨로 바꾼다("낮음"/"보통"/"높음"). */
export function describeAutoReviewRiskLevel(riskLevel: AutoReviewSummary["riskLevel"]): string {
  return riskLevel === "high" ? "높음" : riskLevel === "medium" ? "보통" : "낮음";
}

/**
 * 이 리포트만으로 최종 승인이 가능한지 안내 문구를 계산한다(실제 승인
 * 가능 여부의 최종 판단은 `lib/social/social-post-approval-service.ts`의
 * `approveSocialPost`가 한다 — 이 함수는 화면에 미리 보여줄 안내용이다).
 */
export function describeApprovalReadiness(summary: AutoReviewSummary): string {
  switch (summary.overallStatus) {
    case "blocked":
      return "차단 항목이 있어 수정 전에는 승인할 수 없습니다.";
    case "needs_fix":
      return "수정이 필요한 항목이 있어 승인 전에 수정하는 것을 권장합니다.";
    case "needs_check":
      return "확인이 필요한 항목이 있습니다. 확인 후 승인할 수 있습니다.";
    case "passed":
      return "최종 확인 후 승인할 수 있습니다.";
  }
}

/**
 * quality_status raw 값(not_checked 등)을 그대로 보여주지 않기 위한
 * 최상단 상태 문구 — 아직 자동 검토를 한 번도 실행하지 않은 경우 등
 * checklist 자체가 없을 때 사용한다.
 */
export function describeAutoReviewNotRunYet(qualityStatus: string): string {
  return `아직 자동 검토를 실행하지 않았습니다 (${describeStatusValue(qualityStatus)}).`;
}

// ---------------------------------------------------------------------------
// Phase 3-26: /social-posts/[id]를 "최종 검토·수정·승인 화면"으로 만들기
// 위한 승인 가능 여부 판단 + 상단 요약 카드의 주요 버튼 계산.
// ---------------------------------------------------------------------------

export interface ApprovalGateInput {
  qualityStatus: string;
  approvalStatus: string;
  publishStatus: string;
  hasContent: boolean;
  /** review.counts.blocked + needsFix > 0 인지 — `hasBlockingChecklistItems`와 같은 의미다. */
  hasBlockingIssues: boolean;
}

export interface ApprovalGateStatus {
  canApprove: boolean;
  /** 승인할 수 없을 때 화면에 보여줄 이유. 승인 가능하면 null. */
  reason: string | null;
}

/**
 * `lib/social/social-post-approval-service.ts`의 `checkApprovable`과 같은
 * 규칙을 UI에서 미리 보여주기 위한 판단 함수(최종 승인 여부의 권한 있는
 * 판단은 여전히 서버의 `approveSocialPost`가 한다 — 이 함수는 버튼을
 * disabled로 둘지, 그 이유를 무엇으로 보여줄지만 계산한다).
 */
export function getApprovalGateStatus(input: ApprovalGateInput): ApprovalGateStatus {
  if (input.approvalStatus === "approved") return { canApprove: false, reason: "이미 승인된 글입니다." };
  if (input.publishStatus === "blocked") {
    return { canApprove: false, reason: "게시 상태가 차단되어 있어 승인할 수 없습니다." };
  }
  if (input.publishStatus === "published") {
    return { canApprove: false, reason: "이미 게시된 글은 다시 승인할 수 없습니다." };
  }
  if (input.qualityStatus === "not_checked") {
    return { canApprove: false, reason: "먼저 자동 검토를 실행해야 승인할 수 있습니다." };
  }
  if (input.qualityStatus === "failed") {
    return { canApprove: false, reason: "자동 검토 실행이 실패했습니다. 자동 검토를 다시 실행하세요." };
  }
  if (input.qualityStatus === "blocked") {
    return { canApprove: false, reason: "차단 항목이 있어 승인할 수 없습니다." };
  }
  if (!input.hasContent) return { canApprove: false, reason: "본문이 없어 승인할 수 없습니다." };
  if (input.hasBlockingIssues) {
    return { canApprove: false, reason: "차단되었거나 수정이 필요한 항목이 있어 승인할 수 없습니다." };
  }
  return { canApprove: true, reason: null };
}

export type SocialPostWorkspaceActionKind = "run_review" | "view_body" | "edit" | "approve" | "publish_prep";

export interface SocialPostWorkspaceAction {
  kind: SocialPostWorkspaceActionKind;
  label: string;
}

/**
 * 상단 요약 카드에 강조할 "주요 버튼 1개"를 상태별로 계산한다. 여러
 * primary action이 동시에 경쟁하지 않도록, 이 함수 하나의 결과만
 * 강조 스타일로 렌더링해야 한다.
 */
export function getSocialPostWorkspacePrimaryAction(
  qualityStatus: string,
  approvalStatus: string,
  review: AutoReviewSummary
): SocialPostWorkspaceAction {
  if (approvalStatus === "approved") return { kind: "publish_prep", label: "게시 준비하기" };
  if (qualityStatus === "not_checked" || qualityStatus === "failed") {
    return { kind: "run_review", label: "자동 검토 실행" };
  }
  if (review.overallStatus === "blocked") return { kind: "edit", label: "문제 수정하기" };
  if (review.overallStatus === "needs_fix") return { kind: "edit", label: "수정하기" };
  if (review.overallStatus === "needs_check") return { kind: "view_body", label: "본문 확인하기" };
  return { kind: "approve", label: "최종 승인" };
}
