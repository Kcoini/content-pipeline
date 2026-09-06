// wordpress_blog(및 다른 social platform) 카드의 Step 7 "게시 체크리스트 /
// Handoff"에서, 저장된 checklist item의 status를 그대로 보여주지 않고
// "지금 social_post 상태를 기준으로 다시 계산한 status"를 보여주기 위한
// 순수 로직. 어떤 데이터도 변경하지 않는다.
//
// 배경: buildManualPostingChecklist()가 처음 체크리스트를 만들 때 모든
// item을 status="pending"으로 저장한다(lib/social/platform-manual-posting-checklist-builder.ts).
// 이후 quality_status/approval_status/handoff_status 등이 바뀌어도
// 저장된 checklist item.status는 갱신되지 않아서, 상단 handoff 배지는
// "handoff 완료"인데 아래 15개 항목은 전부 "대기중"으로 보이는 모순이
// 생겼다. 이 모듈은 저장된 status 대신 "지금 상태"를 기준으로 각 item의
// 표시 status를 다시 계산한다.

export type ManualPostingChecklistItemStatus = "completed" | "needs_review" | "pending" | "blocked" | "failed" | "skipped";

export interface ManualPostingChecklistStatusInput {
  qualityStatus: string;
  approvalStatus: string;
  exportStatus: string;
  platformPublishGuardStatus: string;
  platformPublishReady: boolean;
  platformPublishDryRunStatus: string;
  handoffStatus: string;
  manualPostStatus: string;
  postUrl: string | null;
  manualPostUrl: string | null;
}

export interface ManualPostingChecklistDisplayItem {
  key: string;
  label: string;
  status: ManualPostingChecklistItemStatus;
}

export interface ManualPostingChecklistStatusSummary {
  completed: number;
  needsReview: number;
  pending: number;
  blocked: number;
  failed: number;
  skipped: number;
}

/** platformMetadata.manualChecklistConfirmations에 저장하는 confirmation 기록 하나. */
export interface ManualChecklistItemConfirmation {
  confirmed?: boolean;
  confirmedAt?: string;
  confirmedBy?: string;
}

export type ManualChecklistConfirmations = Record<string, ManualChecklistItemConfirmation | undefined>;

/** 시스템이 DB 상태만 보고 자동으로 완료/대기/차단/실패를 판단할 수 있는 항목. */
const AUTO_COMPUTED_KEYS = new Set([
  "quality_gate_ready",
  "approval_approved",
  "manual_export_ready",
  "platform_publishing_guard_ready",
  "publish_dry_run_ready",
  "handoff_completed",
]);

/** "게시 후 URL을 기록/복사했는지" 확인하는 항목 — post_url/manual_post_url 존재 여부로 판단한다. UI가 URL 입력/복사 UI를 붙일 항목을 판단하는 데도 재사용한다. */
export const URL_RECORDED_CHECKLIST_ITEM_KEYS = new Set([
  "record_url_after_posting",
  "wordpress_copy_url",
  "naver_blog_copy_url",
  "naver_cafe_copy_url",
  "x_copy_url",
  "threads_copy_url",
  "instagram_copy_url",
]);

/**
 * "확인 완료 표시" 버튼으로 사람이 직접 confirmed 처리할 수 있는 checklist
 * item key. AUTO_COMPUTED_KEYS/URL_RECORDED_CHECKLIST_ITEM_KEYS에 없는 항목 중, 실제로
 * 사람이 눈으로 봐야 판단 가능한 항목만 포함한다(markManualChecklistItemConfirmed()가
 * 이 목록을 재사용해 잘못된 key로 confirm 처리되는 것을 막는다).
 */
export const CONFIRMABLE_MANUAL_CHECKLIST_ITEM_KEYS = new Set([
  "final_content_check",
  "image_link_check",
  "policy_violation_check",
  "wordpress_workflow_duplicate_check",
  "wordpress_title_body_image_check",
  "wordpress_seo_check",
  "wordpress_visibility_check",
]);

function computeAutoStatus(key: string, input: ManualPostingChecklistStatusInput): ManualPostingChecklistItemStatus {
  switch (key) {
    case "quality_gate_ready":
      if (input.qualityStatus === "ready") return "completed";
      if (input.qualityStatus === "needs_revision" || input.qualityStatus === "blocked") return "blocked";
      return "pending";
    case "approval_approved":
      return input.approvalStatus === "approved" ? "completed" : "pending";
    case "manual_export_ready":
      return input.exportStatus === "ready" || input.exportStatus === "exported" ? "completed" : "pending";
    case "platform_publishing_guard_ready":
      if (input.platformPublishGuardStatus === "ready" && input.platformPublishReady) return "completed";
      if (input.platformPublishGuardStatus === "blocked") return "blocked";
      if (input.platformPublishGuardStatus === "failed") return "failed";
      return "pending";
    case "publish_dry_run_ready":
      return input.platformPublishDryRunStatus === "ready" ? "completed" : "pending";
    case "handoff_completed":
      return input.handoffStatus === "completed" || input.manualPostStatus === "posted" ? "completed" : "pending";
    default:
      return "pending";
  }
}

/**
 * checklist item 하나의 "지금 상태 기준" status를 계산한다.
 * - AUTO_COMPUTED_KEYS: DB 상태로 자동 판단(completed/blocked/failed/pending).
 *   사람이 확인 완료 버튼을 눌러도(confirmations) 이 판단을 덮어쓸 수 없다 —
 *   예를 들어 quality_status가 ready가 아니면 quality_gate_ready를 사람이
 *   임의로 completed로 만들 수 없다.
 * - URL_RECORDED_CHECKLIST_ITEM_KEYS: post_url/manual_post_url 존재 여부로 판단(completed/needs_review).
 * - 그 외(최종 내용 확인, 이미지/링크 확인, SEO 확인 등 사람이 직접 봐야 하는 항목):
 *   사람이 직접 판단해야 하므로 자동으로 완료라고 단정하지 않는다.
 *   confirmations[key].confirmed===true이거나 저장된 item.status가
 *   'confirmed'면 completed, 아니면 needs_review로 표시한다 — 새 DB 컬럼
 *   없이 platformMetadata.manualChecklistConfirmations(JSON)만 사용한다.
 */
export function computeManualPostingChecklistItemStatus(
  key: string,
  storedStatus: string,
  input: ManualPostingChecklistStatusInput,
  confirmations: ManualChecklistConfirmations = {}
): ManualPostingChecklistItemStatus {
  if (AUTO_COMPUTED_KEYS.has(key)) {
    return computeAutoStatus(key, input);
  }
  if (URL_RECORDED_CHECKLIST_ITEM_KEYS.has(key)) {
    return input.manualPostUrl || input.postUrl ? "completed" : "needs_review";
  }
  if (confirmations[key]?.confirmed === true) {
    return "completed";
  }
  return storedStatus === "confirmed" ? "completed" : "needs_review";
}

/** 저장된 checklist 전체에 대해 "지금 상태 기준" status를 다시 계산해 표시용 목록을 만든다. */
export function buildManualPostingChecklistDisplay(
  checklist: { key: string; label: string; status?: string }[],
  input: ManualPostingChecklistStatusInput,
  confirmations: ManualChecklistConfirmations = {}
): ManualPostingChecklistDisplayItem[] {
  return checklist.map((item) => ({
    key: item.key,
    label: item.label,
    status: computeManualPostingChecklistItemStatus(item.key, item.status ?? "pending", input, confirmations),
  }));
}

export function summarizeManualPostingChecklistStatus(
  items: ManualPostingChecklistDisplayItem[]
): ManualPostingChecklistStatusSummary {
  const summary: ManualPostingChecklistStatusSummary = {
    completed: 0,
    needsReview: 0,
    pending: 0,
    blocked: 0,
    failed: 0,
    skipped: 0,
  };
  for (const item of items) {
    switch (item.status) {
      case "completed":
        summary.completed += 1;
        break;
      case "needs_review":
        summary.needsReview += 1;
        break;
      case "pending":
        summary.pending += 1;
        break;
      case "blocked":
        summary.blocked += 1;
        break;
      case "failed":
        summary.failed += 1;
        break;
      case "skipped":
        summary.skipped += 1;
        break;
    }
  }
  return summary;
}

export const MANUAL_POSTING_CHECKLIST_ITEM_STATUS_LABELS: Record<ManualPostingChecklistItemStatus, string> = {
  completed: "완료",
  needs_review: "확인 필요",
  pending: "대기중",
  blocked: "차단됨",
  failed: "실패",
  skipped: "생략",
};

/**
 * 상단 handoff 배지("handoff 완료" 등)와 아래 checklist item 상태가
 * 서로 모순돼 보이지 않도록, handoff가 완료됐는데도 사람이 확인해야
 * 하는 항목이 남아 있으면 보조 안내 문구를 반환한다. 모순이 없으면 null.
 */
export function getChecklistHandoffMismatchNotice(
  handoffStatus: string,
  summary: ManualPostingChecklistStatusSummary
): string | null {
  if (handoffStatus !== "completed") return null;
  const unresolved = summary.needsReview + summary.pending + summary.blocked + summary.failed;
  if (unresolved === 0) return null;
  return "일부 체크리스트 항목은 확인 필요 상태입니다.";
}

/**
 * Step 7 상단 요약 아래에 보여줄 안내 문구를 계산한다.
 * - 확인 필요/대기중/차단됨/실패가 전혀 없으면(모두 완료) 안내가 필요 없다 → null.
 * - 시스템 자동 항목(quality/approval/export/guard/dry-run/handoff)이 전부
 *   해결됐고 사람이 확인해야 하는 항목만 남았으면, 안심시키는 문구를 보여준다.
 * - 그 외(시스템 항목도 아직 안 끝났으면) 확인을 독려하는 일반 문구를 보여준다.
 */
export function getChecklistGuidanceMessage(summary: ManualPostingChecklistStatusSummary): string | null {
  const systemUnresolved = summary.pending + summary.blocked + summary.failed;
  if (summary.needsReview === 0 && systemUnresolved === 0) {
    return null;
  }
  if (summary.needsReview > 0 && systemUnresolved === 0) {
    return "게시 준비는 완료되었습니다. 남은 항목은 사람이 직접 확인해야 하는 최종 점검입니다.";
  }
  if (summary.needsReview > 0) {
    return "확인 필요 항목이 남아 있습니다. WordPress 관리자 화면에서 수동 확인 후 완료 표시를 하세요.";
  }
  return null;
}

/** status badge 옆에 붙이는 한 줄 설명 — "확인 필요"가 오류가 아니라는 것을 badge 텍스트만으로는 알기 어려워서 추가한다. */
export const MANUAL_POSTING_CHECKLIST_ITEM_STATUS_DESCRIPTIONS: Record<ManualPostingChecklistItemStatus, string> = {
  completed: "확인이 끝난 항목입니다.",
  needs_review: "사람이 직접 확인해야 하는 항목입니다.",
  pending: "이전 단계가 끝나야 진행할 수 있습니다.",
  blocked: "필수 조건을 충족하지 못했습니다.",
  failed: "실행 중 오류가 발생했습니다.",
  skipped: "해당 없음으로 건너뛴 항목입니다.",
};

export interface ManualPostingChecklistItemGuide {
  /** 이 항목이 무엇을 확인하라는 뜻인지에 대한 설명. */
  description: string;
  /** 사용자가 지금 해야 할 행동. */
  userAction: string;
}

/**
 * "확인 필요"로 표시되는 checklist item(사람이 직접 확인해야 하는 항목 +
 * URL 기록 항목)에 대한 설명/행동 안내. AUTO_COMPUTED_KEYS(시스템 자동
 * 항목)에는 안내가 필요 없으므로 포함하지 않는다.
 */
export const MANUAL_POSTING_CHECKLIST_ITEM_GUIDES: Record<string, ManualPostingChecklistItemGuide> = {
  final_content_check: {
    description: "WordPress 관리자 화면에서 본문 깨짐, 오탈자, 중복 문장, 출처 표시, AD_SLOT 위치를 확인하세요.",
    userAction: "WordPress Draft 또는 미리보기 화면에서 최종 내용을 확인한 뒤 완료 표시를 하세요.",
  },
  image_link_check: {
    description: "대표 이미지가 정상 표시되는지, 본문 이미지가 깨지지 않는지, 내부/외부 링크가 정상 작동하는지 확인하세요.",
    userAction: "미리보기 화면에서 이미지와 링크를 클릭해 확인하세요.",
  },
  policy_violation_check: {
    description: "과장된 수익 표현, 광고 클릭 유도, 허위 단정, 의료·금융·법률 관련 단정 조언이 없는지 확인하세요.",
    userAction: "문제가 없으면 확인 완료로 표시하세요.",
  },
  record_url_after_posting: {
    description: "WordPress에서 실제 공개 게시를 완료한 뒤, 게시된 URL을 입력하세요.",
    userAction: "공개 URL을 입력하면 완료 상태로 처리됩니다.",
  },
  wordpress_workflow_duplicate_check: {
    description: "원본 article 전송 기능과 wordpress_blog 전송 기능이 중복으로 같은 글을 만들지 않았는지 확인하세요.",
    userAction: "WordPress 관리자에서 중복 Draft 또는 중복 게시글이 없는지 확인하세요.",
  },
  wordpress_title_body_image_check: {
    description:
      "WordPress에 반영된 제목, 본문, 대표 이미지가 wordpress_blog 글 기준인지 확인하세요. article 원문이 잘못 올라가지 않았는지도 확인하세요.",
    userAction: "제목, 본문, 대표 이미지가 의도대로 반영되었으면 확인 완료로 표시하세요.",
  },
  wordpress_seo_check: {
    description: "Rank Math, Yoast, AIOSEO 등 선택한 SEO plugin에 SEO title과 meta description이 제대로 반영되었는지 확인하세요.",
    userAction: "WordPress SEO plugin 화면에서 metadata 반영 여부를 확인하세요.",
  },
  wordpress_visibility_check: {
    description: "글이 Draft 상태인지 Published 상태인지 확인하세요. 자동 공개 게시가 아니라면 WordPress 관리자에서 직접 공개 여부를 결정하세요.",
    userAction: "상태를 확인한 뒤 완료 표시를 하세요.",
  },
  wordpress_copy_url: {
    description: "공개 게시 후 URL을 복사해 기록하거나, 성과 측정에 사용할 수 있게 저장하세요.",
    userAction: "게시 URL을 복사하고 필요한 곳에 기록하세요.",
  },
};
