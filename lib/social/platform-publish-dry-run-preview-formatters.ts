// Phase 3-7: Platform Publish Dry-run & Export Handoff — 미리보기 포맷.
// buildPlatformPublishDryRunPayload() 결과를 사람이 확인하기 좋은
// copy-ready 구조로 변환한다. 실제 게시는 하지 않는다.

import type { SocialPost } from "./social-platform-types";
import { buildPlatformPublishDryRunPayload } from "./platform-publish-dry-run-builder";
import type { PreviewLine, SocialPostPreview } from "./social-post-preview-formatters";

/**
 * dry-run 결과(buildPlatformPublishDryRunPayload)를 플랫폼별로 사람이
 * 확인하기 좋은 미리보기 구조로 변환한다.
 */
export function formatPlatformPublishDryRunPreview(post: SocialPost): SocialPostPreview {
  const result = buildPlatformPublishDryRunPayload(post);

  if (!result.ok) {
    return {
      platform: post.platform,
      heading: "dry-run 불가",
      lines: [{ label: "사유", value: result.error ?? "알 수 없는 오류" }],
      highlights: [],
    };
  }

  const payload = result.dryRunPayload;
  const lines: PreviewLine[] = [];

  switch (post.platform) {
    case "wordpress_blog": {
      lines.push({ label: "title", value: String(payload.title ?? "") });
      lines.push({ label: "excerpt", value: String(payload.excerpt ?? "(없음)") });
      lines.push({ label: "content preview length", value: `${payload.contentPreviewLength ?? 0}자` });
      lines.push({ label: "tags", value: (post.hashtags ?? []).map((tag) => `#${tag}`).join(" ") || "(없음)" });
      break;
    }
    case "naver_blog": {
      lines.push({ label: "title", value: String(payload.title ?? "") });
      lines.push({ label: "body preview", value: String(payload.body ?? "") });
      lines.push({ label: "hashtags", value: (post.hashtags ?? []).map((tag) => `#${tag}`).join(" ") || "(없음)" });
      break;
    }
    case "naver_cafe": {
      lines.push({ label: "title", value: String(payload.title ?? "") });
      lines.push({ label: "body preview", value: String(payload.body ?? "") });
      break;
    }
    case "x": {
      const items = post.threadItems;
      return {
        platform: post.platform,
        heading: `thread ${items.length}개`,
        lines: items.map((item, index) => ({ label: `#${index + 1} (${item.text.length}자)`, value: item.text })),
        highlights: [],
      };
    }
    case "threads": {
      lines.push({ label: "body preview", value: String(payload.body ?? "") });
      lines.push({ label: "hashtags", value: (post.hashtags ?? []).map((tag) => `#${tag}`).join(" ") || "(없음)" });
      break;
    }
    case "instagram": {
      lines.push({ label: "caption preview", value: String(payload.caption ?? "") });
      lines.push({ label: "hashtags", value: (post.hashtags ?? []).map((tag) => `#${tag}`).join(" ") || "(없음)" });
      for (const item of post.cardItems) {
        lines.push({ label: `card ${item.order}: ${item.heading}`, value: item.body });
      }
      lines.push({
        label: "media requirements",
        value: post.mediaRequirements?.requiresImage === true ? "이미지 필요" : "명시되지 않음",
      });
      break;
    }
    default:
      break;
  }

  return { platform: post.platform, heading: "dry-run 미리보기", lines, highlights: [] };
}
