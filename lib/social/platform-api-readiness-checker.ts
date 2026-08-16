// Phase 3-21: Platform API Publishing Preparation.
// 플랫폼별로 "지금 실제 API 게시를 시도해도 되는지"를 판단하는 read-only
// checker다. 이 파일의 어떤 함수도 외부 API를 호출하지 않으며, 환경
// 변수의 값 자체는 어디에도(반환값/로그) 노출하지 않는다 — 이름과
// 설정 여부(있음/없음)만 다룬다.

import { getPlatformApiCapability, type PlatformApiMode } from "./platform-api-capabilities";
import type { SocialPlatform } from "./social-platform-types";

export type PlatformApiReadinessStatus = "not_supported" | "disabled" | "missing_config" | "dry_run_ready" | "ready_for_future_test" | "blocked";

export interface PlatformApiReadinessResult {
  platform: SocialPlatform;
  status: PlatformApiReadinessStatus;
  publishEnabled: boolean;
  dryRunOnly: boolean;
  configured: boolean;
  /** 값이 아니라 이름만 담는다 (예: "X_API_BEARER_TOKEN"). */
  missingEnvVars: string[];
  warnings: string[];
  blockers: string[];
  fallbackMode: PlatformApiMode;
}

/** platform별로 확인할 환경변수 "이름" 목록. 값은 이 파일 밖으로 노출하지 않는다. */
const REQUIRED_ENV_VAR_NAMES: Record<SocialPlatform, string[]> = {
  wordpress_blog: ["WORDPRESS_BASE_URL", "WORDPRESS_USERNAME", "WORDPRESS_APP_PASSWORD"],
  naver_blog: ["NAVER_BLOG_API_CLIENT_ID", "NAVER_BLOG_API_CLIENT_SECRET"],
  naver_cafe: ["NAVER_CAFE_API_CLIENT_ID", "NAVER_CAFE_API_CLIENT_SECRET"],
  x: ["X_API_BEARER_TOKEN"],
  threads: ["THREADS_API_ACCESS_TOKEN"],
  instagram: ["INSTAGRAM_API_ACCESS_TOKEN"],
};

function isCommonPublishingEnabled(): boolean {
  return process.env.PLATFORM_API_PUBLISHING_ENABLED === "true";
}

/** 기본값은 true — 명시적으로 "false"로 설정해야 dry-run 제한이 풀린다(그래도 실제 호출은 별도 Phase에서만 구현됨). */
function isDryRunOnly(): boolean {
  return process.env.PLATFORM_API_DRY_RUN_ONLY !== "false";
}

function isPlatformFlagEnabled(flagName: string): boolean {
  return process.env[flagName] === "true";
}

function findMissingEnvVarNames(platform: SocialPlatform): string[] {
  return REQUIRED_ENV_VAR_NAMES[platform].filter((name) => {
    const value = process.env[name];
    return !value || value.trim().length === 0;
  });
}

/**
 * platform 하나의 API 게시 준비 상태를 확인한다. 환경변수 값 자체는
 * 절대 반환하지 않는다 — 이름과 "있다/없다"만 확인한다.
 */
export function checkPlatformApiReadiness(platform: SocialPlatform): PlatformApiReadinessResult {
  const capability = getPlatformApiCapability(platform);
  const publishEnabled = isCommonPublishingEnabled() && isPlatformFlagEnabled(capability.publishEnabledFlagName);
  const dryRunOnly = isDryRunOnly();
  const missingEnvVars = findMissingEnvVarNames(platform);
  const configured = missingEnvVars.length === 0;
  const warnings = [...capability.warnings];
  const blockers: string[] = [];

  let status: PlatformApiReadinessStatus;

  if (!capability.supportsDryRun) {
    status = "not_supported";
    blockers.push(`${platform}는 아직 dry-run조차 지원하지 않습니다.`);
  } else if (!publishEnabled) {
    status = "disabled";
  } else if (!configured) {
    status = "missing_config";
    blockers.push(`필요한 환경변수가 설정되지 않았습니다 (${missingEnvVars.length}개 누락).`);
  } else if (capability.requiresOAuth) {
    // 이번 Phase 범위에는 OAuth flow/token storage 구현이 없다 — flag/env가
    // 모두 준비돼 보여도 실제 게시 경로로는 진행할 수 없다.
    status = "blocked";
    blockers.push("OAuth flow/token storage가 아직 이 프로젝트에 구현되지 않았습니다 (Phase 3-21 범위 밖).");
  } else if (dryRunOnly) {
    status = "dry_run_ready";
    warnings.push("PLATFORM_API_DRY_RUN_ONLY=true이므로 dry-run까지만 수행됩니다.");
  } else {
    status = "ready_for_future_test";
    warnings.push("모든 조건이 충족됐지만, 실제 API 호출은 이번 단계 코드에 구현되어 있지 않습니다.");
  }

  return {
    platform,
    status,
    publishEnabled,
    dryRunOnly,
    configured,
    missingEnvVars,
    warnings,
    blockers,
    fallbackMode: capability.currentMode,
  };
}
