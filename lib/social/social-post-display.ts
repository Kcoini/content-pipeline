// Phase 3-19: social post 목록/카드 화면에서 "본문 미리보기"를 어떤
// 필드에서 가져올지 결정하는 순수 함수. platform마다 실제 본문이 저장되는
// 필드가 다른데(플랫폼별 지원 필드는
// lib/social/platform-writing-config.ts의 PLATFORM_WRITING_CONFIGS가
// 유일한 기준이다), app/articles/[id]/social/page.tsx의 목록 카드가
// caption/threadItems/cardItems만 확인하고 postBody를 확인하지 않아
// naver_cafe처럼 postBody(본문형) 플랫폼의 글이 실제로는 본문이 있는데도
// "(본문 없음)"으로 보이는 문제가 있었다.
//
// 하드코딩된 platform 이름 목록으로 분기하지 않고, PLATFORM_WRITING_CONFIGS
// 의 supportsBody/supportsCaption을 기준으로 판단한다 — 이렇게 하면 향후
// 플랫폼이 추가되거나 설정이 바뀌어도 이 파일을 따로 수정할 필요가 없다.
//
// 확인된 실제 지원 필드(Phase 3-19 확인 시점):
// - wordpress_blog, naver_blog, naver_cafe, threads: supportsBody=true
//   (postBody가 본문) — naver_cafe와 threads도 caption이 아니라 postBody다.
// - instagram: supportsCaption=true (caption이 본문)
// - x: threadItems 배열 기반(caption/postBody 둘 다 사용하지 않음)

import { PLATFORM_WRITING_CONFIGS } from "./platform-writing-config";
import type { SocialPost } from "./social-platform-types";

/** 목록 카드/미리보기에서 본문으로 표시할 텍스트를 결정한다(플랫폼별 우선순위 반영). */
export function getSocialPostDisplayBody(
  post: Pick<SocialPost, "platform" | "postBody" | "caption" | "threadItems" | "cardItems">
): string {
  // x는 supportsBody 플래그가 true지만(구조상 "본문형" 콘텐츠로 분류될 뿐),
  // 실제로는 postBody/caption을 전혀 쓰지 않고 threadItems 배열에만 내용을
  // 저장한다(lib/social/social-draft-generation-service.ts 확인). 이런
  // 구조화된 배열 콘텐츠가 있으면 postBody/caption 판단보다 먼저 사용한다.
  const threadText = post.threadItems.map((item) => item.text).join(" ");
  if (threadText) return threadText;

  const config = PLATFORM_WRITING_CONFIGS[post.platform];
  const bodyFirst = config.supportsBody
    ? post.postBody?.trim() || post.caption?.trim()
    : post.caption?.trim() || post.postBody?.trim();
  if (bodyFirst) return bodyFirst;

  // instagram card-news처럼 caption도 비어 있고 slide(heading)만 있는 경우의 최후 fallback.
  const cardText = post.cardItems.map((item) => item.heading).join(" ");
  return cardText || "";
}
