// Phase 2-4: SEO Plugin Metadata Mapping 타입 정의.
// Yoast/Rank Math/AIOSEO 등 WordPress SEO plugin별로 metadata payload를
// 변환/저장하기 위한 공통 타입이다. 실제 plugin write는 이번 단계에서
// 구현하지 않는다 (mapping payload 준비까지만).

import type {
  ArticleMode,
  SeoPluginMetadataStatus,
  SeoPluginProvider,
  SeoPluginWriteStatus,
} from "@/lib/types/domain";

export type { SeoPluginProvider, SeoPluginMetadataStatus, SeoPluginWriteStatus };

export function isSeoPluginProvider(value: unknown): value is SeoPluginProvider {
  return value === "none" || value === "yoast" || value === "rank_math" || value === "aioseo";
}

/** WordPress SEO plugin에 전달할 metadata payload (mapping 결과). */
export interface SeoPluginPayload {
  provider: SeoPluginProvider;
  seoTitle: string;
  metaDescription: string;
  focusKeyword?: string;
  secondaryKeywords: string[];
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  schemaType?: string;
  /**
   * plugin별 post meta key 후보. 실제 정답으로 단정하지 않는다 — WordPress
   * 사이트마다 plugin 버전/설정에 따라 노출되는 meta key가 다를 수 있다.
   */
  rawPluginMeta?: Record<string, string>;
  /** "prepared_only": payload만 준비됨(실제 write 안 함). 실제 write 지원 시 "applied"로 확장한다. */
  writeMode?: "prepared_only" | "applied";
}

/** plugin mapper 공통 입력. article/theme에서 추출한 순수 데이터만 담는다. */
export interface SeoPluginMapperInput {
  articleId: string;
  articleMode: ArticleMode;
  title: string;
  seoTitle: string;
  metaDescription: string;
  slug: string;
  targetKeyword?: string;
  secondaryKeywords: string[];
  formatMetadata: Record<string, unknown>;
  wpCategoryNames: string[];
  wpTagNames: string[];
  /** WORDPRESS_BASE_URL + slug로 미리 계산된 canonical URL 후보 (있으면) */
  canonicalUrl?: string;
  /** article_mode 기반으로 미리 계산된 schema.org 타입 후보 */
  schemaType?: string;
}
