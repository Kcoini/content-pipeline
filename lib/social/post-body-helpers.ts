// Phase 4-26: 여러 화면(글 카드/rewrite/대시보드)에서 "본문을 어떻게
// 가져올지"를 각자 다시 판단하지 않도록, 스펙에서 요청한 이름
// (getPostDisplayBody/getPostEditableBody/getPostCopyText/
// getPostPreviewHtml)으로 된 공식 진입점을 이 파일 하나에 모은다.
//
// 실제 판단 로직은 새로 만들지 않는다 — 이미 검증된 기존 함수
// (getSocialPostDisplayBody 등)를 그대로 감싼 얇은 alias일 뿐이다.
// 기존 호출부(app/articles/[id]/blog|social|rewrite/page.tsx,
// app/dashboard/blog|rewrite/page.tsx 등)는 기존 이름을 계속 써도
// 동작이 같다 — 이 파일은 "새 코드가 써야 할 표준 이름"을 제공한다.

import { getSocialPostDisplayBody } from "./social-post-display";
import { convertMarkdownToWordPressHtml } from "@/lib/wordpress/markdown-to-wordpress-html";
import type { SocialPost } from "./social-platform-types";

type DisplayBodySource = Pick<SocialPost, "platform" | "postBody" | "caption" | "threadItems" | "cardItems">;

/**
 * 게시용 본문(플랫폼별 우선순위 반영: post_body → content → caption →
 * excerpt에 해당하는 판단). getSocialPostDisplayBody의 표준 이름 alias.
 */
export function getPostDisplayBody(post: DisplayBodySource): string {
  return getSocialPostDisplayBody(post);
}

/**
 * "편집용 원문" textarea의 초기값. 지금은 게시용 본문과 같은 값을
 * 쓴다(플랫폼마다 별도의 raw 원문 필드를 따로 저장하지 않는다 —
 * wordpress_blog도 postBody 자체가 markdown 원문이다). 값이 게시용
 * 본문과 분리되는 플랫폼이 생기면 이 함수만 바꾸면 된다.
 */
export function getPostEditableBody(post: DisplayBodySource): string {
  return getSocialPostDisplayBody(post);
}

/** [본문 복사] 버튼이 복사할 전체 텍스트. 화면 표시 여부/접힘 상태와 무관하게 항상 전체를 반환한다. */
export function getPostCopyText(post: DisplayBodySource): string {
  return getSocialPostDisplayBody(post);
}

/**
 * "게시용 미리보기"에 렌더링할 HTML. wordpress_blog만 markdown→HTML
 * 변환이 실제로 다르다(Draft 생성 시 보내는 것과 동일한
 * convertMarkdownToWordPressHtml을 재사용 — 별도 변환 로직을 새로
 * 만들지 않는다). 그 외 플랫폼은 원문과 렌더링 결과가 같으므로
 * null을 반환한다 — 호출부는 null이면 plain text(getPostDisplayBody)를
 * 그대로 보여주면 된다.
 */
export function getPostPreviewHtml(post: DisplayBodySource): string | null {
  if (post.platform !== "wordpress_blog") return null;
  const body = getSocialPostDisplayBody(post);
  if (!body.trim()) return null;
  return convertMarkdownToWordPressHtml(body);
}
