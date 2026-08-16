// Phase 3-21: Platform API Publishing Preparation — Threads adapter.
// Threads API는 Meta 앱 심사가 필요하다(platform-api-capabilities.ts
// 참고). 이 adapter는 외부 API를 호출하지 않는다 — fetch를 사용하지
// 않는다.

import { checkPlatformApiReadiness } from "../platform-api-readiness-checker";
import { disabledPublishResult } from "../platform-publish-adapter";
import type {
  PlatformPublishAdapter,
  PlatformApiPublishPayloadInput,
  PlatformApiPublishPayload,
  PlatformApiValidationResult,
  PlatformApiPublishResult,
} from "../platform-publish-adapter";

export const threadsApiPublishAdapter: PlatformPublishAdapter = {
  platform: "threads",

  async buildDryRunPayload(input: PlatformApiPublishPayloadInput): Promise<PlatformApiPublishPayload> {
    const warnings: string[] = [];
    if (!input.postBody) warnings.push("text가 비어 있습니다.");

    return {
      platform: "threads",
      payloadShape: {
        text: input.postBody ?? "",
        link: null,
        media: input.mediaRequirements,
      },
      warnings,
    };
  },

  async validatePayload(payload: PlatformApiPublishPayload): Promise<PlatformApiValidationResult> {
    const shape = payload.payloadShape as { text?: string };
    const errors: string[] = [];
    if (!shape.text || shape.text.trim().length === 0) errors.push("text는 필수입니다.");
    return { valid: errors.length === 0, errors, warnings: payload.warnings };
  },

  async checkReadiness() {
    return checkPlatformApiReadiness("threads");
  },

  async publish(): Promise<PlatformApiPublishResult> {
    return disabledPublishResult("threads");
  },
};
