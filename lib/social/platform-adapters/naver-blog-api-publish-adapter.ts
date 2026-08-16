// Phase 3-21: Platform API Publishing Preparation — Naver Blog adapter.
// 네이버 블로그는 공식 글쓰기 API가 제한적이라 이번 단계는 manual
// export를 기본 경로로 유지한다(platform-api-capabilities.ts 참고).
// 이 adapter는 외부 API를 호출하지 않는다.

import { checkPlatformApiReadiness } from "../platform-api-readiness-checker";
import { disabledPublishResult } from "../platform-publish-adapter";
import type {
  PlatformPublishAdapter,
  PlatformApiPublishPayloadInput,
  PlatformApiPublishPayload,
  PlatformApiValidationResult,
  PlatformApiPublishResult,
} from "../platform-publish-adapter";

export const naverBlogApiPublishAdapter: PlatformPublishAdapter = {
  platform: "naver_blog",

  async buildDryRunPayload(input: PlatformApiPublishPayloadInput): Promise<PlatformApiPublishPayload> {
    const warnings: string[] = ["네이버 블로그는 공식 API가 제한적입니다 — manual export 사용을 권장합니다."];
    if (!input.postTitle) warnings.push("title이 비어 있습니다.");
    if (!input.postBody) warnings.push("content가 비어 있습니다.");

    return {
      platform: "naver_blog",
      payloadShape: {
        title: input.postTitle ?? "",
        content: input.postBody ?? "",
        tags: input.hashtags,
        category: null,
        manualExportFallback: true,
      },
      warnings,
    };
  },

  async validatePayload(payload: PlatformApiPublishPayload): Promise<PlatformApiValidationResult> {
    const shape = payload.payloadShape as { title?: string; content?: string };
    const errors: string[] = [];
    if (!shape.title || shape.title.trim().length === 0) errors.push("title은 필수입니다.");
    if (!shape.content || shape.content.trim().length === 0) errors.push("content는 필수입니다.");
    return { valid: errors.length === 0, errors, warnings: payload.warnings };
  },

  async checkReadiness() {
    return checkPlatformApiReadiness("naver_blog");
  },

  async publish(): Promise<PlatformApiPublishResult> {
    return disabledPublishResult("naver_blog");
  },
};
