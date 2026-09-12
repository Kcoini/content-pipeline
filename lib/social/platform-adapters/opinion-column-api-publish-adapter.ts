// Phase 4-5: Platform API Publishing Preparation — Opinion Column adapter.
// 칼럼(opinion_column)도 news_article과 마찬가지로 특정 CMS/플랫폼 API와
// 연동하지 않는다. manual export를 기본 경로로 유지한다. 이 adapter는
// 외부 API를 호출하지 않는다.

import { checkPlatformApiReadiness } from "../platform-api-readiness-checker";
import { disabledPublishResult } from "../platform-publish-adapter";
import type {
  PlatformPublishAdapter,
  PlatformApiPublishPayloadInput,
  PlatformApiPublishPayload,
  PlatformApiValidationResult,
  PlatformApiPublishResult,
} from "../platform-publish-adapter";

export const opinionColumnApiPublishAdapter: PlatformPublishAdapter = {
  platform: "opinion_column",

  async buildDryRunPayload(input: PlatformApiPublishPayloadInput): Promise<PlatformApiPublishPayload> {
    const warnings: string[] = ["칼럼은 연동된 CMS API가 없습니다 — manual export 사용을 권장합니다."];
    if (!input.postTitle) warnings.push("title이 비어 있습니다.");
    if (!input.postBody) warnings.push("content가 비어 있습니다.");

    return {
      platform: "opinion_column",
      payloadShape: {
        title: input.postTitle ?? "",
        body: input.postBody ?? "",
        manualExportFallback: true,
      },
      warnings,
    };
  },

  async validatePayload(payload: PlatformApiPublishPayload): Promise<PlatformApiValidationResult> {
    const shape = payload.payloadShape as { title?: string; body?: string };
    const errors: string[] = [];
    if (!shape.title || shape.title.trim().length === 0) errors.push("title은 필수입니다.");
    if (!shape.body || shape.body.trim().length === 0) errors.push("body는 필수입니다.");
    return { valid: errors.length === 0, errors, warnings: payload.warnings };
  },

  async checkReadiness() {
    return checkPlatformApiReadiness("opinion_column");
  },

  async publish(): Promise<PlatformApiPublishResult> {
    return disabledPublishResult("opinion_column");
  },
};
