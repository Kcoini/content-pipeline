// Phase 3-21: Platform API Publishing Preparation.
// 플랫폼별 API publishing adapter가 구현해야 하는 공통 interface와
// 공유 타입을 정의한다. 이 파일 자체는 어떤 로직도 구현하지 않는다 —
// 실제 구현은 lib/social/platform-adapters/*.ts에 있다. 어떤 adapter의
// publish()도 실제 외부 API를 호출해서는 안 된다(이번 Phase 범위 밖).

import type { SocialPlatform, ThreadItem, CardItem } from "./social-platform-types";
import type { PlatformApiReadinessResult } from "./platform-api-readiness-checker";

/** adapter가 dry-run payload를 만드는 데 필요한 social_post 정보(최소 집합). */
export interface PlatformApiPublishPayloadInput {
  socialPostId: string;
  articleId: string;
  platform: SocialPlatform;
  postTitle: string | null;
  postBody: string | null;
  caption: string | null;
  excerpt: string | null;
  hashtags: string[];
  threadItems: ThreadItem[];
  cardItems: CardItem[];
  mediaRequirements: Record<string, unknown>;
  postUrl: string | null;
}

/**
 * adapter가 만드는 dry-run payload. payloadShape는 실제 플랫폼 API가
 * 기대하는 형태를 "모방"할 뿐 — 실제 API 호출에 그대로 쓰이는 최종
 * object가 아니다(토큰/서명 등이 전혀 없다).
 */
export interface PlatformApiPublishPayload {
  platform: SocialPlatform;
  payloadShape: Record<string, unknown>;
  warnings: string[];
}

export interface PlatformApiValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/** 이번 Phase에서는 어떤 adapter의 publish()도 항상 실패(disabled)를 반환한다. */
export interface PlatformApiPublishResult {
  success: false;
  status: "disabled" | "not_implemented";
  message: string;
}

export interface PlatformPublishAdapter {
  platform: SocialPlatform;
  /** 외부 API를 호출하지 않고 dry-run payload만 만든다. */
  buildDryRunPayload(input: PlatformApiPublishPayloadInput): Promise<PlatformApiPublishPayload>;
  /** payloadShape가 이 플랫폼이 요구하는 최소 필드를 갖췄는지 확인한다(외부 호출 없음). */
  validatePayload(payload: PlatformApiPublishPayload): Promise<PlatformApiValidationResult>;
  /** feature flag/환경변수 기준 readiness를 확인한다(외부 호출 없음). */
  checkReadiness(): Promise<PlatformApiReadinessResult>;
  /** 구현하더라도 실제 게시는 수행하지 않고 항상 disabled/not_implemented를 반환해야 한다. */
  publish?(payload: PlatformApiPublishPayload): Promise<PlatformApiPublishResult>;
}

/** publish()를 구현하지 않은 adapter를 위한 공용 fallback — 항상 disabled를 반환한다. */
export async function disabledPublishResult(platform: SocialPlatform): Promise<PlatformApiPublishResult> {
  return {
    success: false,
    status: "disabled",
    message: `${platform} API 실제 게시는 이번 단계에서 비활성화되어 있습니다 (Phase 3-21은 준비 단계까지만 지원합니다).`,
  };
}
