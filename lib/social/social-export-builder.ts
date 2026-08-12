// Phase 3-1/3-5: 플랫폼별 manual export payload.
// 실제 외부 플랫폼 게시 API 호출은 이 단계에서 수행하지 않는다 — 사람이
// 복사해서 직접 게시할 수 있는 형태의 payload만 만든다.

import { getPlatformWritingConfig } from "./platform-writing-config";
import type { CardItem, SocialPost } from "./social-platform-types";

const X_MAX_ITEM_LENGTH = 280;

/** Phase 3-5: 플랫폼별 manual export의 상세 payload. */
export interface ManualExportResult {
  ok: boolean;
  platform: string;
  exportFormat: string;
  exportText?: string;
  exportTitle?: string;
  exportBody?: string;
  exportCaption?: string;
  exportHashtags?: string[];
  exportThreadItems?: string[];
  exportCardItems?: CardItem[];
  instructions?: string[];
  warnings?: string[];
  error?: string;
}

const MANUAL_EXPORT_FORMATS: Record<SocialPost["platform"], string> = {
  wordpress_blog: "wordpress_markdown",
  naver_blog: "naver_blog_markdown_copy",
  naver_cafe: "naver_cafe_plain_text_copy",
  x: "x_thread_copy",
  threads: "threads_plain_text_copy",
  instagram: "instagram_caption_card_copy",
};

/**
 * social post를 플랫폼별 manual export(사람이 직접 복사해서 붙여넣는 용도)
 * 상세 payload로 변환한다. 실제 외부 플랫폼 게시는 수행하지 않는다.
 * 필수 콘텐츠가 없으면 ok=false와 error를 반환한다.
 */
export function buildManualExportPayload(post: SocialPost): ManualExportResult {
  const exportFormat = MANUAL_EXPORT_FORMATS[post.platform];

  switch (post.platform) {
    case "wordpress_blog": {
      if (!post.postTitle?.trim() || !post.postBody?.trim()) {
        return { ok: false, platform: post.platform, exportFormat, error: "제목과 본문이 모두 있어야 export할 수 있습니다." };
      }
      return {
        ok: true,
        platform: post.platform,
        exportFormat,
        exportTitle: post.postTitle,
        exportBody: post.postBody,
        exportHashtags: post.hashtags,
        instructions: [
          "WordPress 자동 게시 workflow가 이미 별도로 있으므로 이 manual export는 보조 기능입니다.",
          "excerpt/대표 이미지는 자동 게시 workflow에서 이미 반영된 값을 우선 확인하세요.",
        ],
      };
    }

    case "naver_blog": {
      if (!post.postTitle?.trim() || !post.postBody?.trim()) {
        return { ok: false, platform: post.platform, exportFormat, error: "제목과 본문이 모두 있어야 export할 수 있습니다." };
      }
      return {
        ok: true,
        platform: post.platform,
        exportFormat,
        exportTitle: post.postTitle,
        exportBody: post.postBody,
        exportHashtags: post.hashtags,
        instructions: [
          "네이버 블로그 편집기에 붙여넣기 전 이미지/링크/서식을 확인하세요.",
          "제목, 본문, 태그를 각각 따로 복사할 수 있습니다.",
        ],
      };
    }

    case "naver_cafe": {
      if (!post.postTitle?.trim() || !post.postBody?.trim()) {
        return { ok: false, platform: post.platform, exportFormat, error: "제목과 본문이 모두 있어야 export할 수 있습니다." };
      }
      return {
        ok: true,
        platform: post.platform,
        exportFormat,
        exportTitle: post.postTitle,
        exportBody: post.postBody,
        instructions: [
          "카페 규칙과 홍보성 게시 제한을 반드시 확인하세요.",
          "질문형/토론형 마무리 문장이 있는지 다시 확인하세요.",
          "링크를 남발하지 마세요 (도배로 오인될 수 있습니다).",
        ],
      };
    }

    case "x": {
      if (post.threadItems.length === 0) {
        return { ok: false, platform: post.platform, exportFormat, error: "thread_items가 비어 있어 export할 수 없습니다." };
      }
      const sorted = [...post.threadItems].sort((a, b) => a.order - b.order);
      const overLength = sorted.filter((item) => item.text.length > X_MAX_ITEM_LENGTH);
      return {
        ok: true,
        platform: post.platform,
        exportFormat,
        exportThreadItems: sorted.map((item) => item.text),
        exportText: sorted.map((item, index) => `${index + 1}/${sorted.length} ${item.text}`).join("\n\n"),
        exportHashtags: post.hashtags,
        instructions: ["실제 게시 전 각 스레드의 글자 수와 링크 미리보기를 확인하세요."],
        warnings:
          overLength.length > 0
            ? [`${overLength.length}개의 thread item이 ${X_MAX_ITEM_LENGTH}자를 초과했습니다.`]
            : undefined,
      };
    }

    case "threads": {
      if (!post.postBody?.trim()) {
        return { ok: false, platform: post.platform, exportFormat, error: "본문이 비어 있어 export할 수 없습니다." };
      }
      return {
        ok: true,
        platform: post.platform,
        exportFormat,
        exportBody: post.postBody,
        exportHashtags: post.hashtags,
        instructions: ["Threads에서는 지나친 해시태그보다 자연스러운 문장을 우선하세요."],
      };
    }

    case "instagram": {
      if (!post.caption?.trim()) {
        return { ok: false, platform: post.platform, exportFormat, error: "caption이 비어 있어 export할 수 없습니다." };
      }
      const requiresImageDeclared = post.mediaRequirements?.requiresImage === true;
      return {
        ok: true,
        platform: post.platform,
        exportFormat,
        exportCaption: post.caption,
        exportHashtags: post.hashtags,
        exportCardItems: post.cardItems,
        instructions: [
          "실제 게시에는 이미지 또는 카드뉴스 디자인이 필요합니다.",
          "media_requirements.requiresImage가 true인지 확인하세요.",
        ],
        warnings: requiresImageDeclared ? undefined : ["media_requirements.requiresImage가 true로 명시되어 있지 않습니다."],
      };
    }

    default: {
      const exhaustiveCheck: never = post.platform;
      return {
        ok: false,
        platform: String(exhaustiveCheck),
        exportFormat: "unknown",
        error: `지원하지 않는 platform입니다: ${String(exhaustiveCheck)}`,
      };
    }
  }
}

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
