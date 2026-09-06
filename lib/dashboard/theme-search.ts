// Phase 1-23: 대시보드 좌측 사이드바 "테마 검색" 필터 로직(순수 함수).

/**
 * 제목 기준 대소문자 구분 없이 부분 일치하는 항목만 남긴다. 검색어가 비어
 * 있으면 전체를 반환한다. `getTitle`로 항목에서 제목을 뽑아내는 방법을
 * 지정한다 — 테마 자체(`{ title }`)뿐 아니라 테마를 감싼 목록 항목
 * (`{ theme: { title } }`)에도 그대로 재사용할 수 있게 하기 위함이다.
 */
export function filterThemesByQuery<T>(items: readonly T[], query: string, getTitle: (item: T) => string): T[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [...items];
  return items.filter((item) => getTitle(item).toLowerCase().includes(normalized));
}
