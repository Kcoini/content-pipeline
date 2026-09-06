// Phase 1-17: Daum/Kakao 수집량 조정용 설정. 기본값은 API 호출을 과도하게
//늘리지 않는 보수적인 값이다 — 필요하면 .env.local에서 조정한다.

const DEFAULT_DAUM_SEARCH_PAGE_SIZE = 10;
const DEFAULT_DAUM_SEARCH_MAX_PAGES = 1;
/** 과도한 API 호출을 막기 위한 절대 상한(설정값이 이보다 커도 이 값으로 clamp한다). */
const MAX_DAUM_SEARCH_MAX_PAGES = 5;

/** DAUM_SEARCH_PAGE_SIZE가 없거나 유효하지 않으면 기본값(10)을 사용한다. Kakao API 상한(50)도 함께 적용된다(daum-client.ts). */
export function getDaumSearchPageSize(): number {
  const raw = process.env.DAUM_SEARCH_PAGE_SIZE;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_DAUM_SEARCH_PAGE_SIZE;
}

/** DAUM_SEARCH_MAX_PAGES가 없거나 유효하지 않으면 기본값(1)을 사용하고, 최대 5로 clamp한다. */
export function getDaumSearchMaxPages(): number {
  const raw = process.env.DAUM_SEARCH_MAX_PAGES;
  const parsed = raw ? Number(raw) : NaN;
  const value = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_DAUM_SEARCH_MAX_PAGES;
  return Math.min(value, MAX_DAUM_SEARCH_MAX_PAGES);
}
