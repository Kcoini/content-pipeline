// Phase 3-21: Platform API Publishing Preparation — WordPress adapter.
// 이 adapter는 외부 API를 호출하지 않는다. WordPress는 이미 Phase
// 2-2/2-8부터 실제 draft API 연동이 있지만(WORDPRESS_PUBLISH_ENABLED),
// 그 코드는 lib/publish/publish-service.ts가 그대로 담당하며 이
// adapter는 건드리지 않는다 — 여기서는 "API publishing preparation"
// 준비 상태 확인/미리보기 payload 생성만 한다.

import { checkPlatformApiReadiness } from "../platform-api-readiness-checker";
import { disabledPublishResult } from "../platform-publish-adapter";
import type {
  PlatformPublishAdapter,
  PlatformApiPublishPayloadInput,
  PlatformApiPublishPayload,
  PlatformApiValidationResult,
  PlatformApiPublishResult,
} from "../platform-publish-adapter";

export const wordpressApiPublishAdapter: PlatformPublishAdapter = {
  platform: "wordpress_blog",

  async buildDryRunPayload(input: PlatformApiPublishPayloadInput): Promise<PlatformApiPublishPayload> {
    const warnings: string[] = [];
    if (!input.postTitle) warnings.push("title이 비어 있습니다.");
    if (!input.postBody) warnings.push("content가 비어 있습니다.");

    return {
      platform: "wordpress_blog",
      payloadShape: {
        title: input.postTitle ?? "",
        content: input.postBody ?? "",
        excerpt: input.excerpt ?? "",
        status: "draft",
        categories: [],
        tags: input.hashtags,
        featured_media: null,
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
    return checkPlatformApiReadiness("wordpress_blog");
  },

  async publish(): Promise<PlatformApiPublishResult> {
    return disabledPublishResult("wordpress_blog");
  },
};
