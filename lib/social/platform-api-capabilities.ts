// Phase 3-21: Platform API Publishing Preparation.
// 플랫폼별 API 게시 "가능성"을 나타내는 정적 capability matrix다.
// 이 파일의 어떤 값도 실제 연결이 완료됐다는 뜻이 아니다 — 실제 게시
// 가능 여부는 platform-api-readiness-checker.ts가 환경변수/feature flag를
// 확인해 별도로 판단한다. 이 파일은 DB나 환경변수를 조회하지 않는
// 순수 정적 데이터다.

import type { SocialPlatform } from "./social-platform-types";

/**
 * 이 플랫폼이 지금 실제로 어떤 방식으로 게시되고 있는지.
 * - draft_or_manual_existing: WordPress처럼 기존 Phase(2-2)에서 이미
 *   draft API 연동이 있고, 수동 게시도 병행 가능한 상태.
 * - manual_export: API 연동이 없고 manual export/handoff로만 게시한다.
 * - preparation_only: 이번 Phase에서 준비 구조(adapter/readiness)만
 *   만들었을 뿐, 실제 API 게시 경로는 아직 없다.
 */
export type PlatformApiMode = "draft_or_manual_existing" | "manual_export" | "preparation_only";

export interface PlatformApiCapability {
  platform: SocialPlatform;
  supportsApiPublishing: boolean;
  supportsDryRun: boolean;
  supportsMediaUpload: boolean;
  supportsScheduling: boolean;
  supportsMetricsApi: boolean;
  requiresOAuth: boolean;
  requiresAppReview: boolean;
  currentMode: PlatformApiMode;
  /** 이 플랫폼의 actual publish를 켜는 환경변수 이름(값은 노출하지 않는다). */
  publishEnabledFlagName: string;
  notes: string;
  warnings: string[];
}

const CAPABILITIES: Record<SocialPlatform, PlatformApiCapability> = {
  wordpress_blog: {
    platform: "wordpress_blog",
    supportsApiPublishing: true,
    supportsDryRun: true,
    supportsMediaUpload: true,
    supportsScheduling: false,
    supportsMetricsApi: false,
    requiresOAuth: false,
    requiresAppReview: false,
    currentMode: "draft_or_manual_existing",
    publishEnabledFlagName: "WORDPRESS_API_PUBLISH_ENABLED",
    notes: "Phase 2-2/2-8부터 이미 WordPress REST API draft 생성이 연결되어 있다(WORDPRESS_PUBLISH_ENABLED). 이 Phase의 새 플래그는 별도 준비 상태 확인용이며 기존 워크플로우를 대체하지 않는다.",
    warnings: [],
  },
  naver_blog: {
    platform: "naver_blog",
    supportsApiPublishing: false,
    supportsDryRun: true,
    supportsMediaUpload: false,
    supportsScheduling: false,
    supportsMetricsApi: false,
    requiresOAuth: true,
    requiresAppReview: false,
    currentMode: "manual_export",
    publishEnabledFlagName: "NAVER_BLOG_API_PUBLISH_ENABLED",
    notes: "네이버 블로그는 공식 글쓰기 API가 제한적이라 이번 단계는 manual export를 기본 경로로 유지한다. capability/readiness 구조만 준비해둔다.",
    warnings: ["네이버 블로그 공식 API는 제한적입니다 — 실제 게시는 당분간 manual export를 사용하세요."],
  },
  naver_cafe: {
    platform: "naver_cafe",
    supportsApiPublishing: false,
    supportsDryRun: true,
    supportsMediaUpload: false,
    supportsScheduling: false,
    supportsMetricsApi: false,
    requiresOAuth: true,
    requiresAppReview: false,
    currentMode: "manual_export",
    publishEnabledFlagName: "NAVER_CAFE_API_PUBLISH_ENABLED",
    notes: "네이버 카페는 공개 글쓰기 API가 없어 이번 단계는 manual export를 기본 경로로 유지한다.",
    warnings: ["네이버 카페는 공식 글쓰기 API가 없습니다 — 실제 게시는 manual export를 사용하세요."],
  },
  x: {
    platform: "x",
    supportsApiPublishing: true,
    supportsDryRun: true,
    supportsMediaUpload: true,
    supportsScheduling: false,
    supportsMetricsApi: true,
    requiresOAuth: true,
    requiresAppReview: true,
    currentMode: "preparation_only",
    publishEnabledFlagName: "X_API_PUBLISH_ENABLED",
    notes: "X API v2는 게시가 가능하지만 OAuth/앱 심사가 필요하다. 이번 단계는 준비 구조(readiness/dry-run)만 만들고 실제 게시는 하지 않는다.",
    warnings: [],
  },
  threads: {
    platform: "threads",
    supportsApiPublishing: true,
    supportsDryRun: true,
    supportsMediaUpload: true,
    supportsScheduling: false,
    supportsMetricsApi: true,
    requiresOAuth: true,
    requiresAppReview: true,
    currentMode: "preparation_only",
    publishEnabledFlagName: "THREADS_API_PUBLISH_ENABLED",
    notes: "Threads API는 Meta 앱 심사가 필요하다. 이번 단계는 준비 구조만 만든다.",
    warnings: [],
  },
  instagram: {
    platform: "instagram",
    supportsApiPublishing: true,
    supportsDryRun: true,
    supportsMediaUpload: true,
    supportsScheduling: false,
    supportsMetricsApi: true,
    requiresOAuth: true,
    requiresAppReview: true,
    currentMode: "preparation_only",
    publishEnabledFlagName: "INSTAGRAM_API_PUBLISH_ENABLED",
    notes: "Instagram Graph API는 비즈니스 계정 연결과 Meta 앱 심사가 필요하다. 이번 단계는 준비 구조만 만든다.",
    warnings: [],
  },
};

/** platform 하나의 정적 API capability를 반환한다. DB/환경변수를 조회하지 않는다. */
export function getPlatformApiCapability(platform: SocialPlatform): PlatformApiCapability {
  return CAPABILITIES[platform];
}

/** 전체 플랫폼의 capability 목록(대시보드 표에서 사용). */
export function listPlatformApiCapabilities(): PlatformApiCapability[] {
  return Object.values(CAPABILITIES);
}

/** UI에 보여줄 currentMode 한글 라벨. */
export function getPlatformApiModeLabel(mode: PlatformApiMode): string {
  switch (mode) {
    case "draft_or_manual_existing":
      return "준비 가능 (기존 API 연동 있음)";
    case "manual_export":
      return "수동 export 우선";
    case "preparation_only":
      return "현재 비활성화 (준비 단계)";
    default: {
      const exhaustiveCheck: never = mode;
      throw new Error(`지원하지 않는 mode입니다: ${String(exhaustiveCheck)}`);
    }
  }
}
