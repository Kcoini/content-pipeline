// Phase 4-12: wordpress_blog 게시 준비 화면을 "현재 상태 + 남은 작업 +
// 다음 버튼 1개" 중심으로 정리하기 위한 순수 계산 함수. 어떤 데이터도
// 바꾸지 않고 어떤 action도 호출하지 않는다 — 이미 있는 상태값만 읽어
// "지금 사용자에게 보여줘야 할 것 하나"를 결정론적으로 계산한다.
//
// 기존 lib/social/wordpress-blog-workflow-steps.ts(getWordPressBlogNextRecommendedAction)와
// 겹치는 부분이 있지만, 이 함수는 화면에 필요한 훨씬 풍부한 정보(완료된
// 작업 목록/남은 작업 목록/차단 이유/primary action/secondary actions)를
// 한 번에 반환한다는 점이 다르다. 기존 함수는 삭제하지 않는다(다른
// 화면에서 계속 쓰인다).

export type WordPressPublishPrepActionType =
  | "generate_post"
  | "run_quality_gate"
  | "review_quality_issues"
  | "request_approval"
  | "approve"
  | "set_featured_image"
  | "waive_featured_image"
  | "prepare_checklist"
  | "create_draft"
  | "update_draft"
  | "reflect_seo"
  | "view_draft"
  | "navigate";

export interface WordPressPublishPrepAction {
  label: string;
  actionType: WordPressPublishPrepActionType;
  /** 이 action이 단순 이동(anchor/탭 이동)이면 이동할 위치. */
  href?: string;
}

export interface WordPressPublishPrepStateInput {
  /** post_title/post_body가 실제로 채워져 있는지. */
  bodyExists: boolean;
  /** post.qualityStatus ("not_checked"/"ready"/"needs_revision"/"blocked"/...). */
  qualityStatus: string;
  /** post.approvalStatus ("not_requested"/"pending_review"/"approved"/...). */
  approvalStatus: string;
  /** WordPress draft가 이미 생성되어 있는지(wordpress_post_id 존재 여부). */
  draftExists: boolean;
  draftUrl?: string | null;
  seoTitle?: string | null;
  metaDescription?: string | null;
  targetKeyword?: string | null;
  featuredImageAttached: boolean;
  featuredImageWaived: boolean;
  /** WordPress media id는 저장되어 있지만 아직 연결(attach)되지 않은 상태인지. */
  featuredImageMediaIdPresent: boolean;
  checklistPrepared: boolean;
  /** post.platformPublishGuardStatus ("not_checked"/"ready"/"needs_revision"/"blocked"/"failed"). */
  publishGuardStatus: string;
}

export interface WordPressPublishPrepState {
  /** "대표 이미지와 체크리스트 확인 필요" 같은 한 줄 상태 요약. */
  statusLabel: string;
  /** true여야만 "WordPress에 반영하기"를 primary button으로 보여줄 수 있다. */
  canReflectToWordPress: boolean;
  completedItems: string[];
  remainingItems: string[];
  /** remainingItems의 각 항목을 완전한 문장으로 풀어 쓴 것(차단 안내 카드용). */
  blockingReasons: string[];
  primaryAction: WordPressPublishPrepAction;
  secondaryActions: WordPressPublishPrepAction[];
}

function hasSeoMetadata(input: WordPressPublishPrepStateInput): boolean {
  return Boolean(input.seoTitle?.trim() && input.metaDescription?.trim() && input.targetKeyword?.trim());
}

function isQualityProblem(qualityStatus: string): boolean {
  return qualityStatus === "needs_revision" || qualityStatus === "blocked";
}

const IMAGE_NEEDED_ITEM = "대표 이미지 없음";
const CHECKLIST_NEEDED_ITEM = "게시 체크리스트 미준비";
const SEO_NEEDED_ITEM = "SEO 정보 없음";

/**
 * 지금 상태를 기준으로 "현재 상태 + 완료된 작업 + 남은 작업 + 다음
 * 버튼 1개"를 계산한다. 여러 조건이 동시에 해당돼도 primaryAction은
 * 항상 하나만 반환한다(우선순위: 본문 → 품질검사 → 승인 → 대표 이미지 →
 * 체크리스트 → Draft → SEO → 완료).
 */
export function getWordPressPublishPrepState(input: WordPressPublishPrepStateInput): WordPressPublishPrepState {
  const completedItems: string[] = [];
  const remainingItems: string[] = [];
  const blockingReasons: string[] = [];

  const qualityReady = input.qualityStatus === "ready";
  const approved = input.approvalStatus === "approved";
  const imageResolved = input.featuredImageAttached || input.featuredImageWaived;
  const seoReady = hasSeoMetadata(input);
  const guardBlocked = input.publishGuardStatus === "blocked" || input.publishGuardStatus === "failed";

  // 완료된 작업 — primary와 무관하게, 실제로 끝난 것은 모두 배지로 보여준다.
  if (qualityReady) completedItems.push("품질검사 완료");
  if (approved) completedItems.push("승인 완료");
  if (input.draftExists) completedItems.push("WordPress Draft 생성됨");
  if (seoReady) completedItems.push("SEO 정보 준비됨");
  if (input.featuredImageAttached) completedItems.push("대표 이미지 연결됨");
  else if (input.featuredImageWaived) completedItems.push("대표 이미지 없이 진행 설정됨");
  if (input.checklistPrepared) completedItems.push("게시 체크리스트 준비됨");

  // 남은 작업 — 아직 끝나지 않은 것을 모두 모은다(하나만 primary로 강조하되, 나머지도 목록에는 남긴다).
  if (!qualityReady) {
    remainingItems.push(isQualityProblem(input.qualityStatus) ? "품질검사 문제 확인 필요" : "품질검사 필요");
    blockingReasons.push(
      isQualityProblem(input.qualityStatus)
        ? "품질검사에서 문제가 발견되었습니다. 확인 후 다시 검토하세요."
        : "아직 품질검사를 통과하지 못했습니다."
    );
  }
  if (qualityReady && !approved) {
    remainingItems.push("승인 필요");
    blockingReasons.push("아직 승인되지 않았습니다.");
  }
  if (qualityReady && approved && !imageResolved) {
    remainingItems.push(IMAGE_NEEDED_ITEM);
    blockingReasons.push("대표 이미지가 없습니다.");
  }
  if (qualityReady && approved && !input.checklistPrepared) {
    remainingItems.push(CHECKLIST_NEEDED_ITEM);
    blockingReasons.push("게시 체크리스트가 아직 준비되지 않았습니다.");
  }
  if (qualityReady && approved && imageResolved && input.checklistPrepared && !seoReady) {
    remainingItems.push(SEO_NEEDED_ITEM);
    blockingReasons.push("SEO 정보가 아직 준비되지 않았습니다.");
  }

  // canReflectToWordPress: quality/approval을 통과했고, publish guard가
  // 명시적으로 blocked/failed가 아니어야 한다(not_checked는 아직 확인 전일
  // 뿐이므로 막지 않는다 — "WordPress에 반영하기" 실행 자체가 guard도
  // 함께 확인한다).
  const canReflectToWordPress = qualityReady && approved && !guardBlocked;

  let primaryAction: WordPressPublishPrepAction;
  const secondaryActions: WordPressPublishPrepAction[] = [];

  if (!input.bodyExists) {
    primaryAction = { label: "WordPress 블로그 글 생성", actionType: "generate_post" };
  } else if (!qualityReady) {
    primaryAction = isQualityProblem(input.qualityStatus)
      ? { label: "문제 확인하기", actionType: "review_quality_issues" }
      : { label: "품질검사 실행", actionType: "run_quality_gate" };
  } else if (!approved) {
    primaryAction = { label: "최종 승인하기", actionType: "approve" };
  } else if (!imageResolved) {
    primaryAction = input.featuredImageMediaIdPresent
      ? { label: "대표 이미지 연결하기", actionType: "set_featured_image" }
      : { label: "대표 이미지 설정하기", actionType: "set_featured_image" };
    secondaryActions.push({ label: "이미지 없이 진행", actionType: "waive_featured_image" });
  } else if (!input.checklistPrepared) {
    primaryAction = { label: "게시 체크리스트 만들기", actionType: "prepare_checklist" };
  } else if (!input.draftExists) {
    primaryAction = { label: "WordPress Draft 만들기", actionType: "create_draft" };
  } else if (!seoReady) {
    primaryAction = { label: "SEO 정보 반영하기", actionType: "reflect_seo" };
  } else if (input.publishGuardStatus !== "ready") {
    primaryAction = { label: "WordPress Draft 최종 반영", actionType: "update_draft" };
  } else {
    primaryAction = { label: "WordPress Draft 보기", actionType: "view_draft", href: input.draftUrl ?? undefined };
  }

  // 남은 작업 중 primary로 선택되지 않은 항목은 secondary로 안내한다
  // (체크리스트는 이미지 다음 우선순위이므로, 이미지가 primary일 때도
  // "다음에 해야 할 일"로 미리 보여준다).
  if (primaryAction.actionType !== "prepare_checklist" && qualityReady && approved && !input.checklistPrepared) {
    secondaryActions.push({ label: "게시 체크리스트 만들기", actionType: "prepare_checklist" });
  }
  if (primaryAction.actionType !== "reflect_seo" && qualityReady && approved && imageResolved && input.checklistPrepared && !seoReady) {
    secondaryActions.push({ label: "SEO 정보 반영하기", actionType: "reflect_seo" });
  }
  // Draft가 이미 있으면(아직 최종 완료 전이라도) 언제든 확인할 수 있게 둔다.
  if (input.draftExists && primaryAction.actionType !== "view_draft" && primaryAction.actionType !== "update_draft") {
    secondaryActions.push({ label: "WordPress Draft 보기", actionType: "view_draft", href: input.draftUrl ?? undefined });
  }

  // statusLabel 계산 — remainingItems 중 사용자가 지금 처리해야 하는
  // 항목만 "A와 B 확인 필요" 형태로 요약한다.
  let statusLabel: string;
  if (!input.bodyExists) {
    statusLabel = "본문 작성 필요";
  } else if (!qualityReady) {
    statusLabel = isQualityProblem(input.qualityStatus) ? "품질 문제 확인 필요" : "품질검사 필요";
  } else if (!approved) {
    statusLabel = "승인 필요";
  } else {
    const pendingLabels: string[] = [];
    if (!imageResolved) pendingLabels.push("대표 이미지");
    if (!input.checklistPrepared) pendingLabels.push("체크리스트");
    if (pendingLabels.length > 0) {
      statusLabel = `${pendingLabels.join("와 ")} 확인 필요`;
    } else if (!input.draftExists) {
      statusLabel = "WordPress Draft 생성 필요";
    } else if (!seoReady) {
      statusLabel = "SEO 정보 반영 필요";
    } else if (input.publishGuardStatus !== "ready") {
      statusLabel = "WordPress 반영 준비 완료";
    } else {
      statusLabel = "게시 준비 완료";
    }
  }

  return {
    statusLabel,
    canReflectToWordPress,
    completedItems,
    remainingItems,
    blockingReasons,
    primaryAction,
    secondaryActions,
  };
}
