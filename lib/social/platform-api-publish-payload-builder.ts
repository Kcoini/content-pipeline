// Phase 3-21: Platform API Publishing Preparation.
// social_post 하나를 조회해 표준화된 dry-run payload를 만든다. 실제
// 플랫폼 API를 호출하지 않으며, DB 상태도 바꾸지 않는다(read-only).
// payloadShape에는 미리보기 목적으로 전체 본문이 들어갈 수 있지만,
// 이 값을 pipeline_logs에 저장하는 것은 호출자(preparation service)의
// 책임 하에 절대 금지된다 — 이 파일 자체는 로그를 남기지 않는다.

import { getSocialPostById } from "@/lib/repositories/social-posts-repository";
import { getPlatformPublishAdapter } from "./platform-adapters";
import { classifyContentType, type ContentType } from "./content-type-classifier";
import type { PlatformApiPublishPayloadInput, PlatformApiValidationResult } from "./platform-publish-adapter";
import type { SocialPlatform } from "./social-platform-types";

const PREVIEW_LENGTH = 150;

function preview(text: string | null): string {
  if (!text) return "";
  return text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH)}…` : text;
}

export interface PlatformApiPublishDryRunPayload {
  socialPostId: string;
  articleId: string;
  platform: SocialPlatform;
  contentType: ContentType;
  title: string | null;
  textPreview: string;
  captionPreview: string;
  hashtags: string[];
  mediaRequirements: Record<string, unknown>;
  linkUrl: string | null;
  postUrl: string | null;
  /** 플랫폼별 API 형태를 모방한 미리보기 payload — 실제 API 호출용 최종 object가 아니다. */
  payloadShape: Record<string, unknown>;
  validation: PlatformApiValidationResult;
  warnings: string[];
}

/** social_post를 찾을 수 없으면 null을 반환한다. */
export async function buildPlatformApiPublishDryRunPayload(socialPostId: string): Promise<PlatformApiPublishDryRunPayload | null> {
  const socialPost = await getSocialPostById(socialPostId);
  if (!socialPost) return null;

  const adapter = getPlatformPublishAdapter(socialPost.platform);

  const input: PlatformApiPublishPayloadInput = {
    socialPostId: socialPost.id,
    articleId: socialPost.articleId,
    platform: socialPost.platform,
    postTitle: socialPost.postTitle,
    postBody: socialPost.postBody,
    caption: socialPost.caption,
    excerpt: socialPost.excerpt,
    hashtags: socialPost.hashtags,
    threadItems: socialPost.threadItems,
    cardItems: socialPost.cardItems,
    mediaRequirements: socialPost.mediaRequirements,
    postUrl: socialPost.postUrl,
  };

  const payload = await adapter.buildDryRunPayload(input);
  const validation = await adapter.validatePayload(payload);

  const contentType = classifyContentType({
    kind: "social_post",
    platform: socialPost.platform,
    isRewriteVersion: socialPost.isRewriteVersion,
  });

  return {
    socialPostId: socialPost.id,
    articleId: socialPost.articleId,
    platform: socialPost.platform,
    contentType,
    title: socialPost.postTitle,
    textPreview: preview(socialPost.postBody),
    captionPreview: preview(socialPost.caption),
    hashtags: socialPost.hashtags,
    mediaRequirements: socialPost.mediaRequirements,
    linkUrl: null,
    postUrl: socialPost.postUrl,
    payloadShape: payload.payloadShape,
    validation,
    warnings: [...payload.warnings, ...validation.warnings],
  };
}
