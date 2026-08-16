// Phase 3-21: Platform API Publishing Preparation — X(Twitter) adapter.
// X API v2는 게시 자체는 가능하지만 OAuth/앱 심사가 필요하다
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

export const xApiPublishAdapter: PlatformPublishAdapter = {
  platform: "x",

  async buildDryRunPayload(input: PlatformApiPublishPayloadInput): Promise<PlatformApiPublishPayload> {
    const warnings: string[] = [];
    const hasThread = input.threadItems.length > 0;
    if (!hasThread && !input.postBody) warnings.push("text 또는 thread_items 중 하나가 필요합니다.");

    return {
      platform: "x",
      payloadShape: {
        text: hasThread ? null : input.postBody ?? "",
        threadItems: hasThread ? input.threadItems.map((t) => ({ order: t.order, text: t.text })) : [],
        link: null,
        media: input.mediaRequirements,
      },
      warnings,
    };
  },

  async validatePayload(payload: PlatformApiPublishPayload): Promise<PlatformApiValidationResult> {
    const shape = payload.payloadShape as { text?: string | null; threadItems?: unknown[] };
    const errors: string[] = [];
    const hasText = typeof shape.text === "string" && shape.text.trim().length > 0;
    const hasThread = Array.isArray(shape.threadItems) && shape.threadItems.length > 0;
    if (!hasText && !hasThread) errors.push("text 또는 thread_items 중 하나가 필요합니다.");
    return { valid: errors.length === 0, errors, warnings: payload.warnings };
  },

  async checkReadiness() {
    return checkPlatformApiReadiness("x");
  },

  async publish(): Promise<PlatformApiPublishResult> {
    return disabledPublishResult("x");
  },
};
