// Phase 4-17: Job Progress System — "마지막 진행: 12초 전" 같은 상대 시각
// 표시에 쓰는 순수 함수. 새 날짜 라이브러리를 추가하지 않는다.

/** ISO 문자열을 "12초 전"/"3분 전"/"2시간 전" 같은 상대 시각 문구로 바꾼다. */
export function formatRelativeTimeFromNow(isoString: string | null | undefined, now: Date = new Date()): string {
  if (!isoString) return "알 수 없음";
  const then = new Date(isoString).getTime();
  if (Number.isNaN(then)) return "알 수 없음";

  const diffMs = now.getTime() - then;
  if (diffMs < 0) return "방금 전";

  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 5) return "방금 전";
  if (diffSeconds < 60) return `${diffSeconds}초 전`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}분 전`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}일 전`;
}
