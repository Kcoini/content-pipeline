// Phase 4-6: WordPress SEO 반영 상태를 "일반 사용자가 이해할 수 있는
// 5가지 상태"로 요약한다. 기존 SEO Plugin Actual Write / Custom Endpoint
// 기능(lib/seo/seo-plugin-actual-write-service.ts, provider/env 판단)은
// 그대로 유지하고, 이 파일은 그 결과를 화면 최상단 요약 카드에 보여줄
// 수 있게 다시 계산만 한다(새 DB 컬럼/저장 없음 — 항상 현재 article
// 필드로부터 순수 함수로 계산한다).

import type { SeoPluginActualWriteStatus, SeoPluginCustomEndpointStatus } from "@/lib/types/domain";

export type SeoWriteSummaryStatus = "not_ready" | "ready_to_write" | "written_unconfirmed" | "confirmed" | "error";

export type SeoWriteSummaryPrimaryAction = "generate_seo" | "write_seo" | "check_status" | "view_draft" | "retry";

export interface SeoWriteSummaryInput {
  seoTitle: string | null;
  metaDescription: string | null;
  targetKeyword: string | null;
  /** WordPress draft가 이미 생성되어 있는지(post id 존재 등). */
  hasWordPressDraft: boolean;
  actualWriteStatus: SeoPluginActualWriteStatus;
  actualWriteVerified: boolean;
  actualWriteError: string | null;
  customEndpointStatus: SeoPluginCustomEndpointStatus;
  customEndpointVerified: boolean;
  customEndpointError: string | null;
}

export interface SeoWriteSummary {
  status: SeoWriteSummaryStatus;
  /** 화면 상단에 보여줄 한 문장 상태 설명. */
  statusLabel: string;
  /** 다음에 무엇을 해야 하는지 안내하는 한 문장. */
  nextActionLabel: string;
  primaryAction: SeoWriteSummaryPrimaryAction;
  primaryActionLabel: string;
  /** primary action 버튼을 지금 누를 수 없는 이유(있으면 disabled + 이 문구를 표시한다). */
  primaryActionDisabledReason: string | null;
  seoTitleReady: boolean;
  metaDescriptionReady: boolean;
  focusKeywordReady: boolean;
  wordpressDraftConnected: boolean;
  /** WordPress에 실제로 반영이 확인됐는지(표준 API 또는 custom endpoint 둘 중 하나라도). */
  seoAppliedToWordPress: boolean;
  errorMessage: string | null;
}

const PRIMARY_ACTION_LABEL: Record<SeoWriteSummaryPrimaryAction, string> = {
  generate_seo: "SEO 정보 생성",
  write_seo: "SEO 정보 반영하기",
  check_status: "반영 상태 확인",
  view_draft: "WordPress Draft 보기",
  retry: "다시 시도",
};

/**
 * SEO plugin actual write / custom endpoint 상태를 "SEO 정보 준비 →
 * 반영 → 확인" 5단계 중 하나로 요약한다. raw env/provider/endpoint 값은
 * 이 함수가 다루지 않는다 — 그런 값은 여전히 접힘 영역(상세 보기)에서만
 * 보여준다.
 */
export function summarizeSeoPluginWriteStatus(input: SeoWriteSummaryInput): SeoWriteSummary {
  const seoTitleReady = Boolean(input.seoTitle?.trim());
  const metaDescriptionReady = Boolean(input.metaDescription?.trim());
  const focusKeywordReady = Boolean(input.targetKeyword?.trim());
  const allSeoReady = seoTitleReady && metaDescriptionReady && focusKeywordReady;
  const seoAppliedToWordPress = input.actualWriteVerified || input.customEndpointVerified;
  const errorMessage = input.actualWriteError || input.customEndpointError;

  const base = {
    seoTitleReady,
    metaDescriptionReady,
    focusKeywordReady,
    wordpressDraftConnected: input.hasWordPressDraft,
    seoAppliedToWordPress,
    errorMessage,
  };

  if (input.actualWriteStatus === "failed" || input.customEndpointStatus === "failed") {
    return {
      ...base,
      status: "error",
      statusLabel: "SEO 정보 반영 중 문제가 발생했습니다.",
      nextActionLabel: "상세 오류를 확인하거나 다시 시도하세요.",
      primaryAction: "retry",
      primaryActionLabel: PRIMARY_ACTION_LABEL.retry,
      primaryActionDisabledReason: null,
    };
  }

  if (seoAppliedToWordPress) {
    return {
      ...base,
      status: "confirmed",
      statusLabel: "SEO 정보가 WordPress Draft에 반영되었습니다.",
      nextActionLabel: "WordPress 관리자 화면에서 최종 확인하세요.",
      primaryAction: "view_draft",
      primaryActionLabel: PRIMARY_ACTION_LABEL.view_draft,
      primaryActionDisabledReason: null,
    };
  }

  if (!allSeoReady) {
    return {
      ...base,
      status: "not_ready",
      statusLabel: "SEO 정보가 아직 준비되지 않았습니다.",
      nextActionLabel: "SEO 제목, 설명, Focus Keyword를 먼저 생성하세요.",
      primaryAction: "generate_seo",
      primaryActionLabel: PRIMARY_ACTION_LABEL.generate_seo,
      primaryActionDisabledReason: null,
    };
  }

  const attemptedButUnconfirmed =
    input.actualWriteStatus === "success" ||
    input.actualWriteStatus === "needs_custom_endpoint" ||
    input.customEndpointStatus === "success";
  if (attemptedButUnconfirmed) {
    return {
      ...base,
      status: "written_unconfirmed",
      statusLabel: "SEO 정보를 반영했습니다. 확인이 필요합니다.",
      nextActionLabel: "WordPress에 실제 반영되었는지 확인하세요.",
      primaryAction: "check_status",
      primaryActionLabel: PRIMARY_ACTION_LABEL.check_status,
      primaryActionDisabledReason: null,
    };
  }

  return {
    ...base,
    status: "ready_to_write",
    statusLabel: "SEO 정보가 준비되었습니다.",
    nextActionLabel: "WordPress Draft에 SEO 정보를 반영하세요.",
    primaryAction: "write_seo",
    primaryActionLabel: PRIMARY_ACTION_LABEL.write_seo,
    primaryActionDisabledReason: input.hasWordPressDraft ? null : "먼저 WordPress Draft를 생성해야 SEO 정보를 반영할 수 있습니다.",
  };
}
