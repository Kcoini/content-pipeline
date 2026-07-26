// Phase 2-3: WordPress 게시 준비용 metadata 타입 정의.
// 실제 WordPress API 연결 없이도(WORDPRESS_PUBLISH_ENABLED=false) 카테고리/태그
// 이름, SEO 제목/설명, slug를 생성·저장할 수 있게 한다.

import type { AdSlotEntry, InternalLinkSuggestion, WordPressMetadataStatus } from "@/lib/types/domain";

export type { WordPressMetadataStatus };

export interface WordPressMetadata {
  categoryNames: string[];
  tagNames: string[];
  /** 실제 WordPress API 연결 후 동기화된 카테고리 ID (미연결 시 undefined/빈 배열) */
  categoryIds?: number[];
  /** 실제 WordPress API 연결 후 동기화된 태그 ID (미연결 시 undefined/빈 배열) */
  tagIds?: number[];
  seoTitle: string;
  metaDescription: string;
  slug: string;
  targetKeyword?: string;
  /** target_keyword를 어떻게 결정했는지 (explicit/theme/title_fallback/none) */
  targetKeywordSource?: string;
  secondaryKeywords?: string[];
  internalLinkSuggestions?: InternalLinkSuggestion[];
  adSlots?: AdSlotEntry[];
  status: WordPressMetadataStatus;
}

/** articles.format_metadata.wordpress에 저장되는 구조 (스네이크 케이스, WordPress 전송용 요약). */
export interface WordPressFormatMetadata {
  category_names: string[];
  tag_names: string[];
  slug: string;
  seo_title: string;
  meta_description: string;
  internal_links: InternalLinkSuggestion[];
  ad_slots: AdSlotEntry[];
  target_keyword_source?: string | null;
}

export function toWordPressFormatMetadata(metadata: WordPressMetadata): WordPressFormatMetadata {
  return {
    category_names: metadata.categoryNames,
    tag_names: metadata.tagNames,
    slug: metadata.slug,
    seo_title: metadata.seoTitle,
    meta_description: metadata.metaDescription,
    internal_links: metadata.internalLinkSuggestions ?? [],
    ad_slots: metadata.adSlots ?? [],
    target_keyword_source: metadata.targetKeywordSource ?? null,
  };
}
