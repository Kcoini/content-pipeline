// Phase 3-18: Social Post Detail Route & Pagination.
// query parameter 기반 pagination을 위한 순수 helper. 이 파일의 어떤
// 함수도 DB를 조회하거나 redirect를 수행하지 않는다 — page/perPage 값
// 검증, offset/totalPages 계산, page URL 생성만 담당한다.

export const ALLOWED_PER_PAGE = [10, 20, 50] as const;
export type AllowedPerPage = (typeof ALLOWED_PER_PAGE)[number];

export const DEFAULT_PAGE = 1;
export const DEFAULT_PER_PAGE: AllowedPerPage = 10;

export interface PaginationParams {
  page: number;
  perPage: number;
}

export interface PaginationInfo {
  page: number;
  perPage: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ParsePaginationDefaults {
  page?: number;
  perPage?: AllowedPerPage;
}

type RawPaginationSearchParams = URLSearchParams | { page?: string; perPage?: string };

function readParam(searchParams: RawPaginationSearchParams, key: "page" | "perPage"): string | undefined {
  if (searchParams instanceof URLSearchParams) return searchParams.get(key) ?? undefined;
  return searchParams[key];
}

/**
 * searchParams(page/perPage)를 안전한 정수로 변환한다.
 * - page가 없거나 1보다 작거나 정수가 아니면 1(또는 defaults.page)로 보정한다.
 * - perPage가 10/20/50 중 하나가 아니면 10(또는 defaults.perPage)으로 보정한다.
 */
export function parsePagination(searchParams: RawPaginationSearchParams, defaults: ParsePaginationDefaults = {}): PaginationParams {
  const defaultPage = defaults.page ?? DEFAULT_PAGE;
  const defaultPerPage = defaults.perPage ?? DEFAULT_PER_PAGE;

  const rawPage = readParam(searchParams, "page");
  const parsedPage = rawPage !== undefined ? Number.parseInt(rawPage, 10) : defaultPage;
  const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? Math.floor(parsedPage) : DEFAULT_PAGE;

  const rawPerPage = readParam(searchParams, "perPage");
  const parsedPerPage = rawPerPage !== undefined ? Number.parseInt(rawPerPage, 10) : defaultPerPage;
  const perPage = (ALLOWED_PER_PAGE as readonly number[]).includes(parsedPerPage) ? parsedPerPage : DEFAULT_PER_PAGE;

  return { page, perPage };
}

/** page를 [1, totalPages] 범위로 보정한다. totalPages가 0 이하이면 1을 반환한다. */
export function clampPage(page: number, totalPages: number): number {
  if (totalPages <= 0) return 1;
  if (page < 1) return 1;
  if (page > totalPages) return totalPages;
  return page;
}

/** 1-based page 번호를 0-based offset으로 변환한다. */
export function getOffset(page: number, perPage: number): number {
  return (Math.max(1, page) - 1) * perPage;
}

/** totalCount/page/perPage로 pagination 메타데이터를 계산한다 (page는 유효 범위로 보정된다). */
export function buildPaginationInfo(totalCount: number, page: number, perPage: number): PaginationInfo {
  const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
  const clampedPage = clampPage(page, totalPages);
  return {
    page: clampedPage,
    perPage,
    totalCount,
    totalPages,
    hasNextPage: clampedPage < totalPages,
    hasPreviousPage: clampedPage > 1,
  };
}

/** 배열 하나를 page/perPage로 잘라 현재 page의 항목과 pagination 메타데이터를 함께 반환한다. */
export function paginateItems<T>(items: T[], page: number, perPage: number): { items: T[]; pagination: PaginationInfo } {
  const pagination = buildPaginationInfo(items.length, page, perPage);
  const offset = getOffset(pagination.page, pagination.perPage);
  return { items: items.slice(offset, offset + pagination.perPage), pagination };
}

/**
 * basePath + 기존 query(searchParams)를 유지한 채 page 값만 교체한 URL을 만든다.
 * returnTo/socialPostId/rewriteSuggestionId 등 다른 query parameter는 그대로 보존된다.
 */
export function buildPageUrl(basePath: string, searchParams: URLSearchParams | Record<string, string | undefined>, page: number): string {
  const params = searchParams instanceof URLSearchParams ? new URLSearchParams(searchParams) : new URLSearchParams();
  if (!(searchParams instanceof URLSearchParams)) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (typeof value === "string") params.set(key, value);
    }
  }
  params.set("page", String(page));
  const query = params.toString();
  return query.length > 0 ? `${basePath}?${query}` : basePath;
}

/**
 * 정렬 전(필터링만 끝난) 전체 목록에서 predicate에 맞는 항목이 몇 번째 page에
 * 있는지 계산한다. 찾지 못하면 null을 반환한다 — deep link로 들어온 target이
 * 현재 page에 없을 때 "해당 항목이 있는 page로 이동" 링크를 만드는 데 쓴다.
 */
export function findItemPage<T>(items: T[], predicate: (item: T) => boolean, perPage: number): number | null {
  const index = items.findIndex(predicate);
  if (index === -1) return null;
  return Math.floor(index / perPage) + 1;
}
