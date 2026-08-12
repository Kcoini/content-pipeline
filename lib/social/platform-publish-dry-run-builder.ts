// Phase 3-7: Platform Publish Dry-run & Export Handoff — dry-run payload builder.
// 실제 외부 플랫폼 게시 API 호출은 이 단계에서 수행하지 않는다 — 게시
// 직전에 사람이 최종 확인할 수 있는 payload와 handoff용 payload만 만든다.

import type { CardItem, SocialPost } from "./social-platform-types";

export interface PlatformPublishDryRunResult {
  ok: boolean;
  platform: string;
  dryRunPayload: Record<string, unknown>;
  handoffPayload: Record<string, unknown>;
  checklist: string[];
  warnings: string[];
  error?: string;
}

const X_MAX_ITEM_LENGTH = 280;

function baseFinalChecklist(): string[] {
  return ["최종 내용을 다시 한 번 확인하세요.", "이미지/링크가 올바른지 확인하세요.", "플랫폼 정책 위반 가능성이 없는지 확인하세요."];
}

/**
 * social post를 플랫폼별 게시 직전 dry-run payload로 변환한다. 실제
 * 게시 API는 호출하지 않는다. 필수 콘텐츠가 없으면 ok=false와 error를
 * 반환한다.
 */
export function buildPlatformPublishDryRunPayload(post: SocialPost): PlatformPublishDryRunResult {
  switch (post.platform) {
    case "wordpress_blog": {
      if (!post.postTitle?.trim() || !post.postBody?.trim()) {
        return {
          ok: false,
          platform: post.platform,
          dryRunPayload: {},
          handoffPayload: {},
          checklist: [],
          warnings: [],
          error: "post_title/post_body가 모두 있어야 dry-run을 생성할 수 있습니다.",
        };
      }
      const checklist = [
        ...baseFinalChecklist(),
        "기존 WordPress 자동 게시 workflow(초안/SEO/대표이미지)가 이미 있는지 확인하세요.",
      ];
      const dryRunPayload = {
        type: "wordpress_manual_or_existing_workflow",
        title: post.postTitle,
        contentPreviewLength: post.postBody.length,
        excerpt: post.excerpt ?? null,
        hashtags: post.hashtags,
        note: "기존 WordPress publish workflow가 별도로 있으므로 여기서는 social post dry-run만 생성합니다.",
      };
      return { ok: true, platform: post.platform, dryRunPayload, handoffPayload: dryRunPayload, checklist, warnings: [] };
    }

    case "naver_blog": {
      if (!post.postTitle?.trim() || !post.postBody?.trim()) {
        return {
          ok: false,
          platform: post.platform,
          dryRunPayload: {},
          handoffPayload: {},
          checklist: [],
          warnings: [],
          error: "post_title/post_body가 모두 있어야 dry-run을 생성할 수 있습니다.",
        };
      }
      const checklist = [...baseFinalChecklist(), "네이버 블로그 편집기에 복사/붙여넣기 전 이미지, 링크, 서식을 확인하세요."];
      const dryRunPayload = {
        type: "manual_copy_handoff",
        title: post.postTitle,
        body: post.postBody,
        hashtags: post.hashtags,
        recommendedImages: post.mediaRequirements?.recommendedCount ?? null,
        finalChecklist: checklist,
        note: "네이버 블로그 편집기에 복사/붙여넣기 전 이미지, 링크, 서식 확인이 필요합니다.",
      };
      return { ok: true, platform: post.platform, dryRunPayload, handoffPayload: dryRunPayload, checklist, warnings: [] };
    }

    case "naver_cafe": {
      if (!post.postTitle?.trim() || !post.postBody?.trim()) {
        return {
          ok: false,
          platform: post.platform,
          dryRunPayload: {},
          handoffPayload: {},
          checklist: [],
          warnings: [],
          error: "post_title/post_body가 모두 있어야 dry-run을 생성할 수 있습니다.",
        };
      }
      const checklist = [...baseFinalChecklist(), "카페 규칙, 홍보성 문구, 링크 남발 여부를 확인하세요."];
      const dryRunPayload = {
        type: "manual_copy_handoff",
        title: post.postTitle,
        body: post.postBody,
        finalChecklist: checklist,
        caution: "카페 규칙, 홍보성 문구, 링크 남발을 반드시 확인하세요.",
      };
      return { ok: true, platform: post.platform, dryRunPayload, handoffPayload: dryRunPayload, checklist, warnings: [] };
    }

    case "x": {
      if (post.threadItems.length === 0) {
        return {
          ok: false,
          platform: post.platform,
          dryRunPayload: {},
          handoffPayload: {},
          checklist: [],
          warnings: [],
          error: "thread_items가 비어 있어 dry-run을 생성할 수 없습니다.",
        };
      }
      const sorted = [...post.threadItems].sort((a, b) => a.order - b.order);
      const itemLengths = sorted.map((item) => item.text.length);
      const warnings: string[] = [];
      const overLength = itemLengths.filter((len) => len > X_MAX_ITEM_LENGTH);
      if (overLength.length > 0) {
        warnings.push(`${overLength.length}개의 thread item이 ${X_MAX_ITEM_LENGTH}자를 초과했습니다.`);
      }
      const checklist = [...baseFinalChecklist(), "실제 X API 게시 전 각 item의 글자 수를 확인하세요."];
      const dryRunPayload = {
        type: "x_thread_dry_run",
        threadItems: sorted,
        itemLengths,
        totalItems: sorted.length,
        hashtags: post.hashtags,
        linkPolicy: "외부 링크는 첫 item 또는 마지막 item에만 포함하는 것을 권장합니다.",
        finalChecklist: checklist,
        note: "실제 X API 게시 전 각 item 길이를 확인하세요.",
      };
      return { ok: true, platform: post.platform, dryRunPayload, handoffPayload: dryRunPayload, checklist, warnings };
    }

    case "threads": {
      if (!post.postBody?.trim()) {
        return {
          ok: false,
          platform: post.platform,
          dryRunPayload: {},
          handoffPayload: {},
          checklist: [],
          warnings: [],
          error: "post_body가 비어 있어 dry-run을 생성할 수 없습니다.",
        };
      }
      const checklist = [...baseFinalChecklist(), "실제 Threads 게시 전 문장이 자연스러운지 확인하세요."];
      const dryRunPayload = {
        type: "threads_post_dry_run",
        body: post.postBody,
        hashtags: post.hashtags,
        finalChecklist: checklist,
        note: "실제 Threads 게시 전 문장 자연스러움을 확인하세요.",
      };
      return { ok: true, platform: post.platform, dryRunPayload, handoffPayload: dryRunPayload, checklist, warnings: [] };
    }

    case "instagram": {
      if (!post.caption?.trim()) {
        return {
          ok: false,
          platform: post.platform,
          dryRunPayload: {},
          handoffPayload: {},
          checklist: [],
          warnings: [],
          error: "caption이 비어 있어 dry-run을 생성할 수 없습니다.",
        };
      }
      const warnings: string[] = [];
      const requiresImageDeclared = post.mediaRequirements?.requiresImage === true;
      if (!requiresImageDeclared) {
        warnings.push("media_requirements.requiresImage가 true로 명시되어 있지 않습니다.");
      }
      const checklist = [...baseFinalChecklist(), "실제 게시 전 이미지 또는 카드뉴스 디자인이 준비되었는지 확인하세요."];
      const cardItems: CardItem[] = post.cardItems;
      const dryRunPayload = {
        type: "instagram_caption_card_handoff",
        caption: post.caption,
        hashtags: post.hashtags,
        cardItems,
        mediaRequirements: post.mediaRequirements,
        finalChecklist: checklist,
        note: "실제 게시에는 이미지 또는 카드뉴스 디자인이 필요합니다.",
      };
      return { ok: true, platform: post.platform, dryRunPayload, handoffPayload: dryRunPayload, checklist, warnings };
    }

    default: {
      const exhaustiveCheck: never = post.platform;
      return {
        ok: false,
        platform: String(exhaustiveCheck),
        dryRunPayload: {},
        handoffPayload: {},
        checklist: [],
        warnings: [],
        error: `지원하지 않는 platform입니다: ${String(exhaustiveCheck)}`,
      };
    }
  }
}
