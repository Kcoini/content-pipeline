// Phase 3-16: Content Type Separation & Dashboard Information Architecture.
// article/blog/social/community/rewrite/performance 데이터를 화면에서
// 명확히 구분해 보여주기 위한 순수 분류 함수 모음. 이 파일은 DB를
// 조회하지 않으며, platform과 is_rewrite_version 등 이미 존재하는
// 값만으로 분류한다 — 새 DB 컬럼을 필요로 하지 않는다.

import type { SocialPlatform } from "./social-platform-types";

export type ContentGroup = "original_article" | "blog" | "community" | "social" | "rewrite" | "performance" | "unknown";

export type ContentType =
  | "article"
  | "wordpress_blog"
  | "naver_blog"
  | "monetized_blog"
  | "naver_cafe"
  | "x_thread"
  | "threads_post"
  | "instagram_caption"
  | "rewrite_blog"
  | "rewrite_social"
  | "rewrite_community"
  | "metrics"
  | "rewrite_comparison"
  | "unknown";

/** 플랫폼이 어느 큰 분류(블로그/커뮤니티/SNS)에 속하는지. rewrite 여부와 무관한 원시 분류다. */
export type PlatformGroup = "blog" | "community" | "social" | "unknown";

export type ClassifyContentInput =
  | { kind: "article" }
  | { kind: "social_post"; platform: SocialPlatform; isRewriteVersion: boolean }
  | { kind: "metrics" }
  | { kind: "rewrite_comparison" };

/** platform 하나가 blog/community/social 중 어디에 속하는지 반환한다. */
export function getPlatformGroup(platform: SocialPlatform): PlatformGroup {
  switch (platform) {
    case "wordpress_blog":
    case "naver_blog":
      return "blog";
    case "naver_cafe":
      return "community";
    case "x":
    case "threads":
    case "instagram":
      return "social";
    default:
      return "unknown";
  }
}

/**
 * 화면/대시보드에서 콘텐츠를 묶어 보여주기 위한 상위 분류.
 * - articles 테이블의 원본 글: original_article
 * - social_posts 중 is_rewrite_version=true: rewrite (platform과 무관하게 우선)
 * - social_posts 중 is_rewrite_version=false: platform 기준 blog/community/social
 * - metrics/rewrite_comparison: performance
 */
export function classifyContentGroup(input: ClassifyContentInput): ContentGroup {
  switch (input.kind) {
    case "article":
      return "original_article";
    case "metrics":
    case "rewrite_comparison":
      return "performance";
    case "social_post": {
      if (input.isRewriteVersion) return "rewrite";
      const platformGroup = getPlatformGroup(input.platform);
      if (platformGroup === "unknown") return "unknown";
      return platformGroup;
    }
    default:
      return "unknown";
  }
}

/**
 * content_group보다 더 세분화된 표시용 타입. rewrite version은
 * 원래 platform이 어디였는지에 따라 rewrite_blog/rewrite_social/
 * rewrite_community로 나뉜다.
 */
export function classifyContentType(input: ClassifyContentInput): ContentType {
  switch (input.kind) {
    case "article":
      return "article";
    case "metrics":
      return "metrics";
    case "rewrite_comparison":
      return "rewrite_comparison";
    case "social_post": {
      const platformGroup = getPlatformGroup(input.platform);
      if (input.isRewriteVersion) {
        if (platformGroup === "blog") return "rewrite_blog";
        if (platformGroup === "community") return "rewrite_community";
        if (platformGroup === "social") return "rewrite_social";
        return "unknown";
      }
      switch (input.platform) {
        case "wordpress_blog":
          return "wordpress_blog";
        case "naver_blog":
          return "naver_blog";
        case "naver_cafe":
          return "naver_cafe";
        case "x":
          return "x_thread";
        case "threads":
          return "threads_post";
        case "instagram":
          return "instagram_caption";
        default:
          return "unknown";
      }
    }
    default:
      return "unknown";
  }
}

const CONTENT_GROUP_LABELS: Record<ContentGroup, string> = {
  original_article: "원본 기사",
  blog: "블로그 글",
  community: "커뮤니티 글",
  social: "SNS 글",
  rewrite: "개선 버전",
  performance: "성과",
  unknown: "미분류",
};

export function getContentGroupLabel(group: ContentGroup): string {
  return CONTENT_GROUP_LABELS[group];
}

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  article: "기사 원문",
  wordpress_blog: "WordPress 블로그 글",
  naver_blog: "네이버 블로그 글",
  monetized_blog: "수익형 블로그 글",
  naver_cafe: "네이버 카페 글",
  x_thread: "X 스레드",
  threads_post: "Threads 게시글",
  instagram_caption: "Instagram 캡션",
  rewrite_blog: "블로그 개선 버전",
  rewrite_social: "SNS 개선 버전",
  rewrite_community: "커뮤니티 개선 버전",
  metrics: "성과 지표",
  rewrite_comparison: "성과 비교",
  unknown: "미분류",
};

export function getContentTypeLabel(type: ContentType): string {
  return CONTENT_TYPE_LABELS[type];
}

const PLATFORM_DISPLAY_LABELS: Record<SocialPlatform, string> = {
  wordpress_blog: "WordPress Blog",
  naver_blog: "Naver Blog",
  naver_cafe: "Naver Cafe",
  x: "X",
  threads: "Threads",
  instagram: "Instagram",
};

export function getPlatformDisplayLabel(platform: SocialPlatform): string {
  return PLATFORM_DISPLAY_LABELS[platform];
}

/** content-group-badge.tsx 등 UI 컴포넌트에서 그대로 쓸 수 있는 배지 스타일 정보. */
export interface ContentGroupBadge {
  label: string;
  className: string;
}

const CONTENT_GROUP_BADGE_STYLES: Record<ContentGroup, string> = {
  original_article: "bg-zinc-900 text-white",
  blog: "bg-blue-100 text-blue-700",
  community: "bg-purple-100 text-purple-700",
  social: "bg-pink-100 text-pink-700",
  rewrite: "bg-indigo-100 text-indigo-700",
  performance: "bg-amber-100 text-amber-700",
  unknown: "bg-zinc-100 text-zinc-500",
};

export function getContentGroupBadge(group: ContentGroup): ContentGroupBadge {
  return { label: getContentGroupLabel(group), className: CONTENT_GROUP_BADGE_STYLES[group] };
}
