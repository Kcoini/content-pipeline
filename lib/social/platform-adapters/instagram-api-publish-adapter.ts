// Phase 3-21: Platform API Publishing Preparation — Instagram adapter.
// Instagram Graph API는 비즈니스 계정 연결과 Meta 앱 심사가 필요하다
// (platform-api-capabilities.ts 참고). 이 adapter는 외부 API를
// 호출하지 않는다 — fetch를 사용하지 않는다.

import { checkPlatformApiReadiness } from "../platform-api-readiness-checker";
import { disabledPublishResult } from "../platform-publish-adapter";
import type {
  PlatformPublishAdapter,
  PlatformApiPublishPayloadInput,
  PlatformApiPublishPayload,
  PlatformApiValidationResult,
  PlatformApiPublishResult,
} from "../platform-publish-adapter";

export const instagramApiPublishAdapter: PlatformPublishAdapter = {
  platform: "instagram",

  async buildDryRunPayload(input: PlatformApiPublishPayloadInput): Promise<PlatformApiPublishPayload> {
    const warnings: string[] = [];
    if (!input.caption && input.cardItems.length === 0) warnings.push("caption 또는 card_items 중 하나가 필요합니다.");

    return {
      platform: "instagram",
      payloadShape: {
        caption: input.caption ?? "",
        mediaRequirements: input.mediaRequirements,
        hashtags: input.hashtags,
        cardItems: input.cardItems.map((c) => ({ order: c.order, heading: c.heading, body: c.body })),
        altText: null,
      },
      warnings,
    };
  },

  async validatePayload(payload: PlatformApiPublishPayload): Promise<PlatformApiValidationResult> {
    const shape = payload.payloadShape as { caption?: string; mediaRequirements?: Record<string, unknown> };
    const errors: string[] = [];
    if (!shape.caption || shape.caption.trim().length === 0) errors.push("caption은 필수입니다.");
    if (!shape.mediaRequirements || Object.keys(shape.mediaRequirements).length === 0) {
      errors.push("Instagram은 media 없이 게시할 수 없습니다 (media_requirements 필요).");
    }
    return { valid: errors.length === 0, errors, warnings: payload.warnings };
  },

  async checkReadiness() {
    return checkPlatformApiReadiness("instagram");
  },

  async publish(): Promise<PlatformApiPublishResult> {
    return disabledPublishResult("instagram");
  },
};
