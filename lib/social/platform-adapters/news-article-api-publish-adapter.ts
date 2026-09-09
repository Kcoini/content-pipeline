// Phase 4-3: Platform API Publishing Preparation — News Article adapter.
// 언론 기사(news_article)는 언론사/CMS마다 API가 제각각이고 이 프로젝트가
// 특정 언론사 CMS와 연동하지 않으므로, manual export를 기본 경로로
// 유지한다. 이 adapter는 외부 API를 호출하지 않는다.

import { checkPlatformApiReadiness } from "../platform-api-readiness-checker";
import { disabledPublishResult } from "../platform-publish-adapter";
import type {
  PlatformPublishAdapter,
  PlatformApiPublishPayloadInput,
  PlatformApiPublishPayload,
  PlatformApiValidationResult,
  PlatformApiPublishResult,
} from "../platform-publish-adapter";

export const newsArticleApiPublishAdapter: PlatformPublishAdapter = {
  platform: "news_article",

  async buildDryRunPayload(input: PlatformApiPublishPayloadInput): Promise<PlatformApiPublishPayload> {
    const warnings: string[] = ["언론 기사는 연동된 CMS API가 없습니다 — manual export 사용을 권장합니다."];
    if (!input.postTitle) warnings.push("title이 비어 있습니다.");
    if (!input.postBody) warnings.push("content가 비어 있습니다.");

    return {
      platform: "news_article",
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
    return checkPlatformApiReadiness("news_article");
  },

  async publish(): Promise<PlatformApiPublishResult> {
    return disabledPublishResult("news_article");
  },
};
