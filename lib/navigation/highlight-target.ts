// Phase 3-17: Navigation Return Flow & Deep Links.
// 특정 카드(social_post/rewrite suggestion/rewrite version/comparison/
// metrics)를 query parameter로 찾아와 강조 표시하기 위한 순수 helper.
// DOM에 직접 접근하지 않고 class name/anchor id/찾음 여부만 계산한다.
// 실제 스크롤 이동은 anchor id(`id={buildAnchorId(...)}`)를 부여해
// 브라우저의 기본 hash 이동 동작에 맡긴다 — 별도 스크롤 스크립트를
// 추가하지 않는다.

/** 강조된 카드에 추가하는 Tailwind 클래스. 기존 스타일(border 등)에 얹어서 사용한다. */
export const HIGHLIGHT_CLASS_NAME = "ring-2 ring-indigo-500 ring-offset-2";

/** itemId가 targetId와 같으면(둘 다 존재해야) 강조 대상으로 판단한다. */
export function isHighlighted(itemId: string, targetId: string | null | undefined): boolean {
  if (!targetId) return false;
  return itemId === targetId;
}

/** 강조 대상 카드에 덧붙일 className. 강조 대상이 아니면 빈 문자열을 반환한다. */
export function getHighlightClassName(itemId: string, targetId: string | null | undefined): string {
  return isHighlighted(itemId, targetId) ? HIGHLIGHT_CLASS_NAME : "";
}

/** 카드에 부여할 anchor id. 기존 `social-post-{id}` 규칙과 호환되도록 prefix를 받는다. */
export function buildAnchorId(prefix: string, itemId: string): string {
  return `${prefix}-${itemId}`;
}

/**
 * target id가 지정되어 있지만 현재 페이지에 로드된 목록(existingIds) 어디에도
 * 없으면 true를 반환한다 — "선택한 항목을 찾을 수 없습니다" 경고에 사용한다.
 */
export function resolveHighlightWarning(targetId: string | null | undefined, existingIds: string[]): boolean {
  if (!targetId) return false;
  return !existingIds.includes(targetId);
}
