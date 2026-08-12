// Phase 3-1: 플랫폼별 manual export payload skeleton.
// 실제 외부 플랫폼 게시 API 호출은 이 단계에서 수행하지 않는다 — 사람이
// 복사해서 직접 게시할 수 있는 형태의 payload만 만든다.

import { getPlatformWritingConfig } from "./platform-writing-config";
import type { SocialPost } from "./social-platform-types";

export interface SocialPostExportResult {
  format: string;
  payload: Record<string, unknown>;
}

function buildMarkdownBody(post: SocialPost): string {
  const heading = post.postTitle ? `# ${post.postTitle}\n\n` : "";
  const body = post.postBody ?? "";
  const hashtags = post.hashtags.length > 0 ? `\n\n${post.hashtags.map((tag) => `#${tag}`).join(" ")}` : "";
  return `${heading}${body}${hashtags}`.trim();
}

function buildPlainTextBody(post: SocialPost): string {
  const heading = post.postTitle ? `${post.postTitle}\n\n` : "";
  const body = post.postBody ?? post.caption ?? "";
  const hashtags = post.hashtags.length > 0 ? `\n\n${post.hashtags.map((tag) => `#${tag}`).join(" ")}` : "";
  return `${heading}${body}${hashtags}`.trim();
}

/**
 * social post를 플랫폼별 manual export(사람이 직접 복사해서 붙여넣는 용도)
 * payload로 변환한다. 실제 외부 플랫폼 게시는 수행하지 않는다.
 */
export function buildExportPayload(post: SocialPost): SocialPostExportResult {
  const config = getPlatformWritingConfig(post.platform);

  switch (post.platform) {
    case "wordpress_blog":
      return {
        format: config.exportFormat,
        payload: {
          title: post.postTitle ?? "",
          body: post.postBody ?? "",
        },
      };

    case "naver_blog":
      return {
        format: config.exportFormat,
        payload: {
          title: post.postTitle ?? "",
          markdown: buildMarkdownBody(post),
          hashtags: post.hashtags,
        },
      };

    case "naver_cafe":
      return {
        format: config.exportFormat,
        payload: {
          title: post.postTitle ?? "",
          text: buildPlainTextBody(post),
        },
      };

    case "x":
      return {
        format: config.exportFormat,
        payload: {
          items: post.threadItems,
          hashtags: post.hashtags,
        },
      };

    case "threads":
      return {
        format: config.exportFormat,
        payload: {
          text: buildPlainTextBody(post),
          hashtags: post.hashtags,
        },
      };

    case "instagram":
      return {
        format: config.exportFormat,
        payload: {
          caption: post.caption ?? "",
          hashtags: post.hashtags,
          cardItems: post.cardItems,
        },
      };

    default: {
      const exhaustiveCheck: never = post.platform;
      throw new Error(`지원하지 않는 platform입니다: ${String(exhaustiveCheck)}`);
    }
  }
}
