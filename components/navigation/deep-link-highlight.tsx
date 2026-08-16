// Phase 3-17: Navigation Return Flow & Deep Links.
// deep link로 특정 카드를 찾아왔을 때 보여주는 간단한 안내/경고 배너.
// 새 스타일 라이브러리를 추가하지 않고 기존 Tailwind 유틸리티만 사용한다.

export { getHighlightClassName, resolveHighlightWarning, buildAnchorId, isHighlighted } from "@/lib/navigation/highlight-target";

/**
 * targetId가 있을 때만 표시되는 안내/경고 배너.
 * - found=true: "선택한 항목을 강조 표시했습니다."
 * - found=false: "선택한 항목을 찾을 수 없습니다. 필터 또는 페이지를 확인하세요."
 */
export function DeepLinkNotice({ targetId, found }: { targetId: string | null | undefined; found: boolean }) {
  if (!targetId) return null;

  if (!found) {
    return (
      <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        선택한 항목을 찾을 수 없습니다. 필터 또는 페이지를 확인하세요.
      </div>
    );
  }

  return (
    <div className="rounded border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
      선택한 항목을 강조 표시했습니다.
    </div>
  );
}
