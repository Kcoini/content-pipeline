// Phase 3-1: 플랫폼별 글쓰기 설정.
// 실제 AI 생성/게시는 이 단계에서 구현하지 않으며, 각 플랫폼이 어떤 필드를
// 지원하고 무엇을 금지하는지에 대한 "규칙 테이블"만 정의한다.

import type { PlatformWritingConfig, SocialPlatform } from "./social-platform-types";

/** 모든 플랫폼에 공통으로 금지되는 표현 — 협박/공포 조장/광고 클릭 유도/허위 수익 보장. */
export const BASE_PROHIBITED_PATTERNS: readonly string[] = [
  "협박",
  "가만두지 않겠다",
  "당장 하지 않으면",
  "광고 클릭",
  "지금 클릭",
  "무조건 돈 버는",
  "수익 보장",
  "원금 보장",
  "확정 수익",
];

const BASE_CHECKLIST_KEYS: readonly string[] = [
  "platform_valid",
  "tone_style_valid",
  "content_present",
  "no_threat_language",
  "no_ad_click_bait",
  "no_income_guarantee",
  "required_fields_present",
];

export const PLATFORM_WRITING_CONFIGS: Record<SocialPlatform, PlatformWritingConfig> = {
  wordpress_blog: {
    platform: "wordpress_blog",
    purpose: "SEO long-form blog post",
    supportsTitle: true,
    supportsBody: true,
    supportsCaption: false,
    supportsHashtags: false,
    supportsThreads: false,
    supportsImages: true,
    requiresImage: true,
    preferredLength: "long",
    exportFormat: "html_or_markdown",
    maxLength: 8000,
    minLength: 800,
    recommendedHashtagCount: 0,
    requiresHumanApproval: true,
    allowAutoPublish: false,
    prohibitedPatterns: [...BASE_PROHIBITED_PATTERNS],
    qualityChecklistKeys: [...BASE_CHECKLIST_KEYS, "length_check", "image_required_check"],
  },
  naver_blog: {
    platform: "naver_blog",
    purpose: "search-friendly Korean blog post",
    supportsTitle: true,
    supportsBody: true,
    supportsCaption: false,
    supportsHashtags: true,
    supportsThreads: false,
    supportsImages: true,
    requiresImage: false,
    preferredLength: "medium_to_long",
    exportFormat: "markdown_copy",
    maxLength: 6000,
    minLength: 600,
    recommendedHashtagCount: 5,
    requiresHumanApproval: true,
    allowAutoPublish: false,
    prohibitedPatterns: [...BASE_PROHIBITED_PATTERNS],
    qualityChecklistKeys: [...BASE_CHECKLIST_KEYS, "length_check", "hashtag_check"],
  },
  naver_cafe: {
    platform: "naver_cafe",
    purpose: "community discussion / question style",
    supportsTitle: true,
    supportsBody: true,
    supportsCaption: false,
    supportsHashtags: false,
    supportsThreads: false,
    supportsImages: false,
    requiresImage: false,
    preferredLength: "medium",
    exportFormat: "plain_text_copy",
    maxLength: 3000,
    minLength: 300,
    recommendedHashtagCount: 0,
    requiresHumanApproval: true,
    allowAutoPublish: false,
    prohibitedPatterns: [...BASE_PROHIBITED_PATTERNS],
    qualityChecklistKeys: [...BASE_CHECKLIST_KEYS, "length_check"],
  },
  x: {
    platform: "x",
    purpose: "hook and thread",
    supportsTitle: false,
    supportsBody: true,
    supportsCaption: false,
    supportsHashtags: true,
    supportsThreads: true,
    supportsImages: true,
    requiresImage: false,
    preferredLength: "short",
    exportFormat: "thread_json",
    maxLength: 280,
    minLength: 20,
    recommendedHashtagCount: 2,
    requiresHumanApproval: true,
    allowAutoPublish: false,
    prohibitedPatterns: [...BASE_PROHIBITED_PATTERNS],
    qualityChecklistKeys: [...BASE_CHECKLIST_KEYS, "thread_items_check", "hashtag_check"],
  },
  threads: {
    platform: "threads",
    purpose: "conversational insight",
    supportsTitle: false,
    supportsBody: true,
    supportsCaption: false,
    supportsHashtags: true,
    supportsThreads: false,
    supportsImages: true,
    requiresImage: false,
    preferredLength: "short_to_medium",
    exportFormat: "plain_text_copy",
    maxLength: 500,
    minLength: 30,
    recommendedHashtagCount: 2,
    requiresHumanApproval: true,
    allowAutoPublish: false,
    prohibitedPatterns: [...BASE_PROHIBITED_PATTERNS],
    qualityChecklistKeys: [...BASE_CHECKLIST_KEYS, "length_check", "hashtag_check"],
  },
  instagram: {
    platform: "instagram",
    purpose: "caption and card-news copy",
    supportsTitle: false,
    supportsBody: false,
    supportsCaption: true,
    supportsHashtags: true,
    supportsThreads: false,
    supportsImages: true,
    requiresImage: true,
    preferredLength: "caption",
    exportFormat: "caption_and_card_items",
    maxLength: 2200,
    minLength: 30,
    recommendedHashtagCount: 8,
    requiresHumanApproval: true,
    allowAutoPublish: false,
    prohibitedPatterns: [...BASE_PROHIBITED_PATTERNS],
    qualityChecklistKeys: [...BASE_CHECKLIST_KEYS, "hashtag_check", "card_items_check", "image_required_check"],
  },
};

export function getPlatformWritingConfig(platform: SocialPlatform): PlatformWritingConfig {
  return PLATFORM_WRITING_CONFIGS[platform];
}

/** platform → `contracts/social/*.schema.json` 파일명 매핑 (Phase 3-2). */
export const SOCIAL_OUTPUT_CONTRACT_FILENAMES: Record<SocialPlatform, string> = {
  wordpress_blog: "wordpress-blog.schema.json",
  naver_blog: "naver-blog.schema.json",
  naver_cafe: "naver-cafe.schema.json",
  x: "x-thread.schema.json",
  threads: "threads.schema.json",
  instagram: "instagram-caption.schema.json",
};

/** platform → `prompts/social/*.md` 파일명 매핑 (Phase 3-2). */
export const SOCIAL_PLATFORM_PROMPT_FILENAMES: Record<SocialPlatform, string> = {
  wordpress_blog: "wordpress-blog.md",
  naver_blog: "naver-blog.md",
  naver_cafe: "naver-cafe.md",
  x: "x-thread.md",
  threads: "threads.md",
  instagram: "instagram-caption.md",
};

export function getSocialOutputContractName(platform: SocialPlatform): string {
  return SOCIAL_OUTPUT_CONTRACT_FILENAMES[platform];
}
