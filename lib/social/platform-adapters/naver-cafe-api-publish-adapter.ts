// Phase 3-21: Platform API Publishing Preparation — Naver Cafe adapter.
// 네이버 카페는 공개 글쓰기 API가 없어 이번 단계는 manual export를
// 기본 경로로 유지한다. 이 adapter는 외부 API를 호출하지 않는다.

import { checkPlatformApiReadiness } from "../platform-api-readiness-checker";
import { disabledPublishResult } from "../platform-publish-adapter";
import type {
  PlatformPublishAdapter,
  PlatformApiPublishPayloadInput,
  PlatformApiPublishPayload,
  PlatformApiValidationResult,
  PlatformApiPublishResult,
} from "../platform-publish-adapter";

export const naverCafeApiPublishAdapter: PlatformPublishAdapter = {
  platform: "naver_cafe",

  async buildDryRunPayload(input: PlatformApiPublishPayloadInput): Promise<PlatformApiPublishPayload> {
    const warnings: string[] = ["네이버 카페는 공식 글쓰기 API가 없습니다 — manual export 사용을 권장합니다."];
    if (!input.postBody) warnings.push("body가 비어 있습니다.");

    return {
      platform: "naver_cafe",
      payloadShape: {
        title: input.postTitle ?? "",
        body: input.postBody ?? "",
        board: null,
        category: null,
        manualExportFallback: true,
      },
      warnings,
    };
  },

  async validatePayload(payload: PlatformApiPublishPayload): Promise<PlatformApiValidationResult> {
    const shape = payload.payloadShape as { body?: string };
    const errors: string[] = [];
    if (!shape.body || shape.body.trim().length === 0) errors.push("body는 필수입니다.");
    return { valid: errors.length === 0, errors, warnings: payload.warnings };
  },

  async checkReadiness() {
    return checkPlatformApiReadiness("naver_cafe");
  },

  async publish(): Promise<PlatformApiPublishResult> {
    return disabledPublishResult("naver_cafe");
  },
};
