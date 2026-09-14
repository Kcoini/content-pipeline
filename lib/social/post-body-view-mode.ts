// Phase 4-24: 글 카드의 "본문 확인" 영역이 플랫폼마다 기본으로 강조해야
// 하는 보기(viewMode)를 결정한다. 실제 렌더링/편집 로직은 바꾸지 않고,
// "이 플랫폼은 게시용 미리보기를 먼저 보여줄지, 복사용 텍스트를 먼저
// 보여줄지"만 순수 함수로 판단한다 — AI 재호출 없는 결정적 계산이다.
//
// - preview: 실제 게시될 모습 확인이 우선(WordPress/네이버 블로그,
//   언론 기사형/칼럼처럼 그대로 게시되거나 검토용으로 통째로 읽는 글).
// - copy: 수동으로 복사해서 붙여넣는 경우가 많은 플랫폼(네이버 카페,
//   X/Threads/Instagram)은 "복사용 텍스트"를 우선 보여준다.
//
// source(편집용 원문, markdown/HTML raw)는 wordpress_blog처럼 렌더링
// 결과와 원문이 실제로 다른 플랫폼에서만 의미가 있다 —
// WORDPRESS_BLOG_CARD_TABS(preview/content)가 이미 그 역할을 한다.

import type { SocialPlatform } from "./social-platform-types";

export type PostBodyViewMode = "preview" | "source" | "copy";

const COPY_DEFAULT_PLATFORMS: readonly SocialPlatform[] = ["naver_cafe", "x", "threads", "instagram"];

/** 플랫폼별 기본 viewMode. 목록에 없으면(=대부분 블로그/기사형) preview가 기본이다. */
export function getDefaultPostBodyViewMode(platform: SocialPlatform): PostBodyViewMode {
  return COPY_DEFAULT_PLATFORMS.includes(platform) ? "copy" : "preview";
}

const VIEW_MODE_LABELS: Record<PostBodyViewMode, string> = {
  preview: "게시용 미리보기",
  source: "편집용 원문",
  copy: "복사용 텍스트",
};

/** 사용자 화면에 보여줄 viewMode 한글 라벨. */
export function getPostBodyViewModeLabel(mode: PostBodyViewMode): string {
  return VIEW_MODE_LABELS[mode];
}
