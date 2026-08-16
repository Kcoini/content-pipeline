// Phase 3-22: Automation Safety Review — feature flag 안전 점검.
// 이 파일은 process.env 값을 직접 노출하지 않는다. 각 flag의 "설정 여부"와
// "안전 기본값 여부"만 판단해 반환한다.

import type { AutomationSafetySeverity } from "./automation-safety-review-types";

export type FeatureFlagAuditStatus = "safe" | "warning" | "critical";

export interface FeatureFlagAuditItem {
  flagName: string;
  /** 환경변수가 설정되어 있는지 여부(값 자체는 노출하지 않음). */
  configured: boolean;
  /** 이 flag의 안전한 기본값(모두 "false"로 두는 것이 안전한 flag들이다). */
  safeDefault: "false" | "true";
  status: FeatureFlagAuditStatus;
  severity: AutomationSafetySeverity;
  message: string;
}

/** 실제 게시를 활성화할 수 있는 flag 목록. 모두 기본값이 false(비활성)여야 안전하다. */
const AUTO_PUBLISH_DISABLED_BY_DEFAULT_FLAGS = [
  "PLATFORM_API_PUBLISHING_ENABLED",
  "X_API_PUBLISH_ENABLED",
  "THREADS_API_PUBLISH_ENABLED",
  "INSTAGRAM_API_PUBLISH_ENABLED",
  "NAVER_BLOG_API_PUBLISH_ENABLED",
  "NAVER_CAFE_API_PUBLISH_ENABLED",
  "WORDPRESS_API_PUBLISH_ENABLED",
  "SOCIAL_PUBLISH_ENABLED",
] as const;

/** dry-run 전용 여부를 보장해야 하는 flag. true가 기본값이자 안전값이다. */
const DRY_RUN_ONLY_FLAGS = ["PLATFORM_API_DRY_RUN_ONLY"] as const;

function auditDisabledByDefaultFlag(flagName: string): FeatureFlagAuditItem {
  const rawValue = process.env[flagName];
  const configured = rawValue !== undefined && rawValue !== "";
  const enabled = rawValue === "true";

  if (enabled) {
    return {
      flagName,
      configured,
      safeDefault: "false",
      status: "critical",
      severity: "critical",
      message: `${flagName}이(가) true로 설정되어 있습니다. 실제 자동 게시를 유발할 수 있으므로 즉시 false로 되돌려야 합니다.`,
    };
  }

  return {
    flagName,
    configured,
    safeDefault: "false",
    status: "safe",
    severity: "info",
    message: `${flagName}은(는) 비활성화 상태입니다(안전).`,
  };
}

function auditDryRunOnlyFlag(flagName: string): FeatureFlagAuditItem {
  const rawValue = process.env[flagName];
  const configured = rawValue !== undefined && rawValue !== "";
  const dryRunOnly = rawValue !== "false";

  if (!dryRunOnly) {
    return {
      flagName,
      configured,
      safeDefault: "true",
      status: "critical",
      severity: "critical",
      message: `${flagName}이(가) false로 설정되어 dry-run 전용 제한이 해제되어 있습니다. 즉시 true로 되돌려야 합니다.`,
    };
  }

  return {
    flagName,
    configured,
    safeDefault: "true",
    status: "safe",
    severity: "info",
    message: `${flagName}은(는) dry-run 전용 상태를 유지하고 있습니다(안전).`,
  };
}

/**
 * 게시 관련 feature flag 전체를 점검한다. 환경변수의 실제 값은
 * 절대 반환하지 않으며, 설정 여부와 안전/경고/위험 상태만 반환한다.
 */
export function auditPublishingFeatureFlags(): FeatureFlagAuditItem[] {
  return [
    ...AUTO_PUBLISH_DISABLED_BY_DEFAULT_FLAGS.map(auditDisabledByDefaultFlag),
    ...DRY_RUN_ONLY_FLAGS.map(auditDryRunOnlyFlag),
  ];
}
