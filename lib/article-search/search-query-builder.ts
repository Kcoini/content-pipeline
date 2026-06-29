// Phase 1-13: theme 정보에서 기사 검색 쿼리 목록을 생성한다.

import type { Theme } from "@/lib/types/domain";

/**
 * theme.title + keywords → 최대 5개의 검색 쿼리 목록 반환.
 * 순서: 제목 그대로 → 키워드 2개 조합 → 제목+첫키워드 조합.
 */
export function buildSearchQueries(theme: Theme): string[] {
  const queries: string[] = [];

  if (theme.title.trim()) {
    queries.push(theme.title.trim());
  }

  const kws = theme.keywords.filter(Boolean).slice(0, 4);

  // 키워드 2개씩 조합
  for (let i = 0; i < kws.length - 1; i++) {
    queries.push(`${kws[i]} ${kws[i + 1]}`);
  }

  // 제목 + 첫 번째 키워드
  if (theme.title.trim() && kws.length > 0 && kws[0] !== theme.title.trim()) {
    queries.push(`${kws[0]} ${theme.title.trim()}`);
  }

  // 중복 제거, 최대 5개
  return [...new Set(queries)].slice(0, 5);
}
