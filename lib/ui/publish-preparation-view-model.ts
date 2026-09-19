// Phase UX-05A: "승인 완료 이후 사용자가 무엇을 해야 하는지"를 플랫폼
// 공통 shape 하나로 표현하기 위한 어댑터. 새 publish engine을 만들지
// 않는다 — 이미 있는 계산 로직을 그대로 재사용한다:
//   - wordpress_blog: lib/social/wordpress-blog-publish-prep-state.ts (getWordPressPublishPrepState)
//   - 그 외 플랫폼: lib/social/post-approval-next-actions.ts (getPostApprovalNextActions)
// 이 파일은 두 함수의 결과를 읽어 shape만 바꾼다(business logic 재구현 없음).
//
// 중요(현재 실제 capability, 2026-09-18 기준 코드 조사 결과): 이
// 프로젝트에는 "실제 외부 API로 즉시 게시"하는 기능이 **어떤
// 플랫폼에도 구현되어 있지 않다**(PLATFORM_API_PUBLISHING_ENABLED가
// true여도 readiness status는 "dry_run_ready" 또는
// "ready_for_future_test"까지만 — 실제 발행 호출 코드가 아예 없다,
// platform-api-readiness-checker.ts/post-approval-next-actions.ts의
// 주석 참고). 그래서 이 어댑터는 naver_cafe/x/threads/instagram에도
// "게시하기"라는 아직 존재하지 않는 action을 만들지 않는다 — primary
// action은 항상 실제로 지금 클릭해서 뭔가 일어나는 것(본문 복사 등)
// 이어야 한다는 프로젝트 원칙을 따른다.

import type { SocialPlatform, SocialPostPublishStatus, ManualPostStatus } from "@/lib/social/social-platform-types";
import type { WordPressPublishPrepState, WordPressPublishPrepActionType } from "@/lib/social/wordpress-blog-publish-prep-state";
import type { PostApprovalNextActionsResult, PostApprovalNextActionType } from "@/lib/social/post-approval-next-actions";

// Phase UX-06: UX-05B에서 "action_completed"(시스템 작업은 끝났지만
// 외부 게시 확인 전) state를 타입에 추가했지만, 실제로 이 state를
// 만드는 adapter 로직은 끝내 없었다 — WordPress Draft 조회(view_draft)와
// 본문 복사(copy_body)는 여전히 "ready"로만 분류된다. 이 프로젝트에는
// "시스템 작업은 끝났다"는 것을 판단할 신뢰할 수 있는 서버 측 source
// of truth가 없다(복사는 클라이언트 로컬 이벤트일 뿐이고, WordPress
// Draft 조회는 "다시 봐도 되는 준비 완료" 그 자체이지 새로운 단계가
// 아니다). "clipboard 로컬 상태를 backend publish state로 오해하지
// 않는다"는 원칙에 따라 억지로 연결하지 않고, 대신 아무도 만들지
// 못하는 dead state를 제거했다(사용되지 않는 상태를 남겨 미래 UX
// 복잡도를 만들지 않는다) — 다시 필요해지면(예: 실제 비동기 게시
// job이 생기면) 그때 실제 source of truth와 함께 추가한다.
export type PublishPreparationState = "not_approved" | "needs_attention" | "needs_setup" | "ready" | "in_progress" | "completed" | "failed";

const STATE_LABELS: Record<PublishPreparationState, string> = {
  not_approved: "승인 필요",
  needs_attention: "확인 필요",
  needs_setup: "게시 설정 필요",
  ready: "게시 준비 완료",
  in_progress: "처리 중",
  completed: "완료",
  failed: "처리 실패",
};

/**
 * 이 프로젝트에 실제로 존재하는 게시 방식 3가지. "direct_publish"(API
 * 즉시 게시)는 아직 어떤 플랫폼에도 구현되어 있지 않으므로 이 타입에
 * 포함하지 않는다 — 나중에 실제로 구현되면 그때 추가한다.
 */
export type PublishCapability = "draft" | "manual" | "copy";

const PLATFORM_CAPABILITY: Record<SocialPlatform, PublishCapability> = {
  wordpress_blog: "draft",
  naver_blog: "manual",
  news_article: "manual",
  opinion_column: "manual",
  naver_cafe: "copy",
  x: "copy",
  threads: "copy",
  instagram: "copy",
};

export function getPublishCapability(platform: SocialPlatform): PublishCapability {
  return PLATFORM_CAPABILITY[platform];
}

export interface PublishPreparationAction {
  type: string;
  label: string;
  href?: string;
  disabled?: boolean;
  disabledReason?: string;
}

export interface PublishPreparationViewModel {
  platform: SocialPlatform;
  state: PublishPreparationState;
  title: string;
  message?: string;
  completedItems?: string[];
  remainingItems?: string[];
  primaryAction?: PublishPreparationAction;
  secondaryActions?: PublishPreparationAction[];
}

/** publishStatus/manualPostStatus를 확인해 completed/failed로 덮어써야 하는지 판단한다(모든 플랫폼 공통). */
function overrideByPublishOutcome(
  publishStatus: SocialPostPublishStatus,
  manualPostStatus: ManualPostStatus | undefined
): PublishPreparationState | null {
  if (publishStatus === "published" || manualPostStatus === "posted") return "completed";
  if (publishStatus === "failed" || manualPostStatus === "failed") return "failed";
  return null;
}

const WORDPRESS_ACTION_STATE: Record<WordPressPublishPrepActionType, PublishPreparationState> = {
  generate_post: "not_approved",
  run_quality_gate: "not_approved",
  review_quality_issues: "not_approved",
  request_approval: "not_approved",
  approve: "not_approved",
  set_featured_image: "needs_attention",
  waive_featured_image: "needs_attention",
  prepare_checklist: "needs_attention",
  reflect_seo: "needs_attention",
  create_draft: "ready",
  update_draft: "ready",
  view_draft: "ready",
  navigate: "ready",
};

/**
 * getWordPressPublishPrepState() 결과를 PublishPreparationViewModel로
 * 바꾼다. approve 이전 단계(본문/품질검사/승인)는 세부 사유와
 * 무관하게 전부 "not_approved"로 묶는다 — 이 ViewModel은 "게시 준비"
 * 단계만 다루므로, 더 세밀한 이전 단계 구분은 기존 WorkflowStatusCard/
 * NextActionPanel(WordPress 카드에 이미 적용됨)의 몫으로 남긴다.
 */
export function fromWordPressPublishPrepStateToPublishPreparation(
  prep: WordPressPublishPrepState,
  publishStatus: SocialPostPublishStatus
): PublishPreparationViewModel {
  const outcomeOverride = overrideByPublishOutcome(publishStatus, undefined);
  const state = outcomeOverride ?? WORDPRESS_ACTION_STATE[prep.primaryAction.actionType] ?? "ready";

  return {
    platform: "wordpress_blog",
    state,
    title: STATE_LABELS[state],
    message: prep.statusLabel,
    completedItems: prep.completedItems,
    remainingItems: prep.remainingItems,
    primaryAction:
      outcomeOverride === "completed"
        ? { type: "view_draft", label: "WordPress Draft 보기", href: undefined }
        : { type: prep.primaryAction.actionType, label: prep.primaryAction.label, href: prep.primaryAction.href },
    secondaryActions: outcomeOverride
      ? []
      : prep.secondaryActions.map((a) => ({ type: a.actionType, label: a.label, href: a.href })),
  };
}

const POST_APPROVAL_ACTION_STATE: Record<PostApprovalNextActionType, PublishPreparationState> = {
  copy_body: "ready",
  view_detail: "ready",
  view_wordpress_draft: "ready",
  create_wordpress_draft: "ready",
  check_wordpress_publish_readiness: "needs_attention",
  prepare_manual_export: "ready",
  check_api_readiness: "ready",
};

/**
 * getPostApprovalNextActions() 결과를 PublishPreparationViewModel로
 * 바꾼다(wordpress_blog 이외 플랫폼용). approvalStatus가 아직
 * "approved"가 아니면 이 함수를 호출하지 않고 별도로 "not_approved"
 * ViewModel을 만든다(호출부에서 분기) — getPostApprovalNextActions
 * 자체가 "승인 완료 이후"만 다루는 함수이기 때문이다.
 */
export function fromPostApprovalNextActionsToPublishPreparation(
  platform: SocialPlatform,
  result: PostApprovalNextActionsResult,
  publishStatus: SocialPostPublishStatus,
  manualPostStatus?: ManualPostStatus
): PublishPreparationViewModel {
  const outcomeOverride = overrideByPublishOutcome(publishStatus, manualPostStatus);
  const state = outcomeOverride ?? POST_APPROVAL_ACTION_STATE[result.primaryAction.actionType] ?? "ready";

  return {
    platform,
    state,
    title: STATE_LABELS[state],
    message: result.message,
    primaryAction:
      outcomeOverride === "completed"
        ? { type: "view_detail", label: "게시글 보기", href: undefined }
        : { type: result.primaryAction.actionType, label: result.primaryAction.label },
    secondaryActions: outcomeOverride
      ? []
      : result.secondaryActions.map((a) => ({ type: a.actionType, label: a.label })),
  };
}

/** 아직 승인되지 않은 post의 "승인 필요" ViewModel(공통 — 모든 플랫폼). */
export function notApprovedPublishPreparation(platform: SocialPlatform): PublishPreparationViewModel {
  return {
    platform,
    state: "not_approved",
    title: STATE_LABELS.not_approved,
    message: "아직 승인되지 않았습니다. 먼저 검토·승인을 완료하세요.",
  };
}

export function describePublishPreparationState(state: PublishPreparationState): string {
  return STATE_LABELS[state];
}
