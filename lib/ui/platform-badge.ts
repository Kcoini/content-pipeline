// Phase UX-03C: 여러 페이지에 따로 구현되어 있던 PlatformBadge를 통합하는
// 공통 label/style 계산 유틸. 이 프로젝트에는 실제로 서로 다른 두 "platform"
// 개념이 있다 — (1) 글을 올리는 대상 플랫폼(SocialPlatform: wordpress_blog/
// naver_blog/naver_cafe/x/threads/instagram/news_article/opinion_column,
// 기존 source of truth는 lib/social/platform-generation-recommendations.ts의
// PLATFORM_LABELS)과 (2) 트렌드 후보를 수집한 검색 출처(naver/daum/mock,
// app/trends, app/themes/[themeId]에서 raw 문자열로 노출되던 값). 두 개념을
// 하나로 합치지 않고, 이 파일에서 "platform 문자열 하나를 받아 사용자 라벨/
// 배지 스타일을 반환"하는 공통 계산 로직만 한 곳에 모은다.

import { PLATFORM_LABELS } from "@/lib/social/platform-generation-recommendations";
import { isSocialPlatform } from "@/lib/social/social-platform-types";

export type TrendSourcePlatform = "naver" | "daum" | "mock";

const TREND_SOURCE_PLATFORMS: readonly TrendSourcePlatform[] = ["naver", "daum", "mock"];

function isTrendSourcePlatform(value: string): value is TrendSourcePlatform {
  return (TREND_SOURCE_PLATFORMS as readonly string[]).includes(value);
}

const TREND_SOURCE_PLATFORM_LABELS: Record<TrendSourcePlatform, string> = {
  naver: "네이버",
  daum: "다음",
  mock: "테스트 데이터",
};

const TREND_SOURCE_PLATFORM_BADGE_CLASSES: Record<TrendSourcePlatform, string> = {
  naver: "bg-green-100 text-green-700",
  daum: "bg-blue-100 text-blue-700",
  mock: "bg-zinc-100 text-zinc-600",
};

const CONTENT_PLATFORM_BADGE_CLASS = "bg-indigo-50 text-indigo-700";
const UNKNOWN_PLATFORM_BADGE_CLASS = "bg-zinc-100 text-zinc-600";

/** platform 문자열(raw key) → 사용자 친화적 한국어 라벨. 알 수 없는 값은 원문을 그대로 반환한다(완전히 새 platform이 추가됐을 때 화면이 비어 보이지 않게). */
export function describePlatformBadge(platform: string): string {
  if (isSocialPlatform(platform)) return PLATFORM_LABELS[platform];
  if (isTrendSourcePlatform(platform)) return TREND_SOURCE_PLATFORM_LABELS[platform];
  return platform;
}

/** platform 문자열 → 배지 배경/글자색 Tailwind class. */
export function getPlatformBadgeClassName(platform: string): string {
  if (isTrendSourcePlatform(platform)) return TREND_SOURCE_PLATFORM_BADGE_CLASSES[platform];
  if (isSocialPlatform(platform)) return CONTENT_PLATFORM_BADGE_CLASS;
  return UNKNOWN_PLATFORM_BADGE_CLASS;
}
