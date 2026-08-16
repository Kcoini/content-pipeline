// Phase 3-18: Social Post Detail Route & Pagination.
// 서버 컴포넌트에서 그대로 쓸 수 있는 pagination UI. 페이지 이동은 일반
// <Link> 링크(page query parameter만 교체)로 처리하고, perPage 선택은
// 기존 프로젝트가 쓰던 `<form method="get">` 패턴(예: "rewrite 포함"
// 체크박스)을 그대로 따라 client component 없이 구현한다. 새 UI
// 라이브러리는 추가하지 않는다.

import Link from "next/link";
import { ALLOWED_PER_PAGE, buildPageUrl, type PaginationInfo } from "@/lib/navigation/pagination";

function toParamsRecord(searchParams: URLSearchParams | Record<string, string | undefined>): Record<string, string> {
  if (searchParams instanceof URLSearchParams) {
    return Object.fromEntries(searchParams.entries());
  }
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") result[key] = value;
  }
  return result;
}

/**
 * 이전/다음 페이지 이동, "N / 전체 페이지", "총 M개", perPage 선택을 보여준다.
 * totalCount가 0이면 아무것도 렌더링하지 않는다(빈 목록에 pagination을 보일 필요 없음).
 */
export function PaginationControls({
  basePath,
  searchParams,
  pagination,
  showPerPageSelector = true,
}: {
  basePath: string;
  searchParams: URLSearchParams | Record<string, string | undefined>;
  pagination: PaginationInfo;
  showPerPageSelector?: boolean;
}) {
  const { page, totalPages, totalCount, hasNextPage, hasPreviousPage, perPage } = pagination;

  if (totalCount === 0) return null;

  const paramsWithoutPerPage = { ...toParamsRecord(searchParams) };
  delete paramsWithoutPerPage.perPage;

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-2 text-xs text-zinc-500">
      <span>
        {page} / {totalPages} 페이지 · 총 {totalCount}개
      </span>

      <div className="flex flex-wrap items-center gap-2">
        {showPerPageSelector && (
          <form method="get" className="flex items-center gap-1">
            {Object.entries(paramsWithoutPerPage)
              .filter(([key]) => key !== "page")
              .map(([key, value]) => (
                <input key={key} type="hidden" name={key} value={value} />
              ))}
            <input type="hidden" name="page" value="1" />
            <label className="flex items-center gap-1">
              페이지당
              <select name="perPage" defaultValue={String(perPage)} className="rounded border border-zinc-300 px-1 py-0.5">
                {ALLOWED_PER_PAGE.map((value) => (
                  <option key={value} value={value}>
                    {value}개
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="rounded border border-zinc-300 bg-zinc-50 px-2 py-0.5 hover:bg-zinc-100">
              적용
            </button>
          </form>
        )}

        <div className="flex gap-1">
          {hasPreviousPage ? (
            <Link href={buildPageUrl(basePath, searchParams, page - 1)} className="rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-700 hover:bg-zinc-100">
              ← 이전
            </Link>
          ) : (
            <span className="rounded border border-zinc-200 bg-zinc-100 px-2 py-1 text-zinc-300">← 이전</span>
          )}
          {hasNextPage ? (
            <Link href={buildPageUrl(basePath, searchParams, page + 1)} className="rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-700 hover:bg-zinc-100">
              다음 →
            </Link>
          ) : (
            <span className="rounded border border-zinc-200 bg-zinc-100 px-2 py-1 text-zinc-300">다음 →</span>
          )}
        </div>
      </div>
    </div>
  );
}
