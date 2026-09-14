// Phase 4-22: 자동 검토(quality gate) checklist 항목 하나하나를
// "AI가 사용자에게 묻지 않고 자동으로 고쳐도 되는 문제(auto_fixable)",
// "사실/출처/민감한 판단이 필요해 사용자 확인이 필요한 문제
// (user_confirmation_required)", "게시/승인을 막아야 하는 문제
// (blocking)" 3종류로 분류하는 순수 함수. 이 파일 자체는 아무것도
// 수정하지 않는다 — 실제 자동 수정은 lib/social/post-auto-fix-service.ts
// 가 담당하며, 그 서비스는 이 분류 중 "실제로 구현된 자동 수정기가
// 있는 항목"(canAutoFix=true)만 건드린다.

import type { SocialPostQualityChecklistItem } from "./social-platform-types";

export type ReviewIssueFixability = "auto_fixable" | "user_confirmation_required" | "blocking";

export interface ClassifiedReviewIssue extends SocialPostQualityChecklistItem {
  fixability: ReviewIssueFixability;
  /**
   * fixability가 "auto_fixable"이어도, 실제로 이 프로젝트에 구현된
   * 결정론적 자동 수정기가 있는 항목만 true다(예: 내부 소제목 정리,
   * naver_cafe markdown escape 정리). false면 "고칠 수는 있는 유형"이지만
   * 아직 자동 수정 로직이 없어 사람이 "본문 수정"으로 직접 고쳐야 한다
   * — 이 구분 없이 무작정 canAutoFix=true로 표시하면 실제로는 아무 일도
   * 일어나지 않는 "자동 수정" 버튼을 만들게 된다.
   */
  canAutoFix: boolean;
  requiresUserConfirmation: boolean;
  blocksApproval: boolean;
}

/**
 * 결정론적 자동 수정기가 실제로 존재하는 checklist key.
 * (lib/social/internal-section-heading-sanitizer.ts,
 * lib/social/naver-cafe-plain-text-sanitizer.ts가 처리한다 —
 * post-auto-fix-service.ts에서 재사용.)
 */
const IMPLEMENTED_AUTO_FIXERS = new Set<string>([
  "no_internal_section_headings",
  "naver_cafe_no_markdown_heading",
  "naver_cafe_no_markdown_escape",
]);

/**
 * "AI가 사용자에게 묻지 않고 고쳐도 되는 표현·구조·형식 문제" 종류의
 * checklist key(구현 여부와 무관하게 개념적으로 auto_fixable인 것들).
 * 여기 없는 key는 기본적으로 user_confirmation_required로 취급한다
 * (모르는 문제를 함부로 "자동으로 고쳐도 된다"고 낙관하지 않는다).
 */
const AUTO_FIXABLE_KEYS = new Set<string>([
  "no_internal_section_headings",
  "naver_cafe_no_markdown_heading",
  "naver_cafe_no_markdown_escape",
  "wordpress_blog_heading_structure",
  "wordpress_blog_body_depth",
  "wordpress_blog_no_slash_joined_points",
  "wordpress_blog_non_generic_opening",
  "news_article_lead_present",
  "naver_blog_keyword_repetition",
]);

/**
 * "사실 확인/출처/수치/기관명/민감한 판단이 필요한" 문제 종류의 대표
 * checklist key 예시 — 별도 Set으로 분기하지 않는다. AUTO_FIXABLE_KEYS/
 * ALWAYS_BLOCKING_KEYS 어디에도 없는 key는 아래 classifyReviewIssue의
 * 기본값(user_confirmation_required)으로 자연스럽게 떨어진다: "알 수
 * 없는 문제는 자동으로 고쳐도 된다"고 낙관하지 않기 위한 안전한
 * 기본값이다. 예: news_article_no_unsourced_claim,
 * wordpress_blog_single_source_verification_needed_section,
 * wordpress_blog_single_source_notice,
 * wordpress_blog_source_date_notice_present.
 */

/**
 * 안전(safety) 성격이라 항상 blocking으로 취급하는 key. status가
 * "blocked"가 아니어도(예: fail) blocking으로 강제한다 — 자동 수정으로
 * 넘기면 안 되는 항목이다.
 */
const ALWAYS_BLOCKING_KEYS = new Set<string>([
  "content_present",
  "no_pii_exposure",
  "no_threat_language",
  "no_ad_click_bait",
  "no_income_guarantee",
  "naver_cafe_promotional_language",
  "naver_cafe_no_localhost_link",
  "naver_cafe_no_internal_status_leak",
]);

/**
 * checklist 항목 하나를 분류한다.
 *
 * 우선순위:
 * 1. status === "blocked" 이거나 ALWAYS_BLOCKING_KEYS에 있으면 항상 blocking.
 * 2. status === "pass"면 문제가 아니므로 auto_fixable로 두되
 *    blocksApproval/requiresUserConfirmation은 모두 false다(참고용).
 * 3. AUTO_FIXABLE_KEYS에 있으면 auto_fixable(구현 여부는 canAutoFix로 별도 표시).
 * 4. USER_CONFIRMATION_KEYS에 있거나, 그 외 알 수 없는 key면
 *    user_confirmation_required(안전한 기본값).
 */
export function classifyReviewIssue(item: SocialPostQualityChecklistItem): ClassifiedReviewIssue {
  const isImplemented = IMPLEMENTED_AUTO_FIXERS.has(item.key);

  if (item.status === "blocked" || ALWAYS_BLOCKING_KEYS.has(item.key)) {
    return {
      ...item,
      fixability: "blocking",
      canAutoFix: false,
      requiresUserConfirmation: false,
      blocksApproval: item.status !== "pass",
    };
  }

  if (item.status === "pass") {
    return { ...item, fixability: "auto_fixable", canAutoFix: false, requiresUserConfirmation: false, blocksApproval: false };
  }

  if (AUTO_FIXABLE_KEYS.has(item.key)) {
    return {
      ...item,
      fixability: "auto_fixable",
      canAutoFix: isImplemented,
      requiresUserConfirmation: !isImplemented,
      blocksApproval: false,
    };
  }

  // 출처/수치/기관명 확인 등 사실 판단이 필요한 key와, 목록에 없는
  // 알 수 없는 key 모두 여기서 안전하게 user_confirmation_required로
  // 취급한다.
  return {
    ...item,
    fixability: "user_confirmation_required",
    canAutoFix: false,
    requiresUserConfirmation: true,
    blocksApproval: false,
  };
}

/** checklist 전체를 한 번에 분류한다. */
export function classifyReviewIssues(checklist: SocialPostQualityChecklistItem[]): ClassifiedReviewIssue[] {
  return checklist.map(classifyReviewIssue);
}

export interface ReviewIssueSummary {
  autoFixable: ClassifiedReviewIssue[];
  userConfirmationRequired: ClassifiedReviewIssue[];
  blocking: ClassifiedReviewIssue[];
}

/** 분류 결과를 3개 배열로 나눠 반환한다(문제가 있는 항목만 — pass는 제외). */
export function summarizeReviewIssues(checklist: SocialPostQualityChecklistItem[]): ReviewIssueSummary {
  const classified = classifyReviewIssues(checklist).filter((item) => item.status !== "pass");
  return {
    autoFixable: classified.filter((item) => item.fixability === "auto_fixable"),
    userConfirmationRequired: classified.filter((item) => item.fixability === "user_confirmation_required"),
    blocking: classified.filter((item) => item.fixability === "blocking"),
  };
}

/**
 * Phase 4-28: "글 생성 직후 사용자가 보기 전에 자동 수정·재검토를
 * 실행해도 되는가"를 판단하는 순수 함수 — 남은 문제(status !== "pass")가
 * 하나 이상 있고, 그 전부가 auto_fixable이면서 실제 자동 수정기가
 * 구현된(canAutoFix) 항목일 때만 true다. user_confirmation_required나
 * blocking 문제가 하나라도 섞여 있으면(또는 문제가 전혀 없으면) false —
 * 이 경우는 기존처럼 사용자가 결과를 먼저 확인해야 한다.
 */
export function hasOnlyImplementedAutoFixableIssues(checklist: SocialPostQualityChecklistItem[]): boolean {
  const problems = classifyReviewIssues(checklist).filter((item) => item.status !== "pass");
  return problems.length > 0 && problems.every((item) => item.fixability === "auto_fixable" && item.canAutoFix);
}
