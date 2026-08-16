import { describe, expect, it } from "vitest";
import {
  parsePagination,
  clampPage,
  getOffset,
  buildPaginationInfo,
  paginateItems,
  buildPageUrl,
  findItemPage,
  DEFAULT_PAGE,
  DEFAULT_PER_PAGE,
} from "./pagination";

describe("parsePagination", () => {
  it("page 기본값은 1이다", () => {
    expect(parsePagination({})).toEqual({ page: DEFAULT_PAGE, perPage: DEFAULT_PER_PAGE });
  });

  it("perPage 기본값은 10이다", () => {
    expect(parsePagination({}).perPage).toBe(10);
  });

  it("잘못된 page(0 이하, 정수 아님)는 1로 보정한다", () => {
    expect(parsePagination({ page: "0" }).page).toBe(1);
    expect(parsePagination({ page: "-3" }).page).toBe(1);
    expect(parsePagination({ page: "abc" }).page).toBe(1);
  });

  it("허용된 perPage(10/20/50)는 그대로 사용한다", () => {
    expect(parsePagination({ perPage: "10" }).perPage).toBe(10);
    expect(parsePagination({ perPage: "20" }).perPage).toBe(20);
    expect(parsePagination({ perPage: "50" }).perPage).toBe(50);
  });

  it("허용되지 않은 perPage는 10으로 보정한다", () => {
    expect(parsePagination({ perPage: "7" }).perPage).toBe(10);
    expect(parsePagination({ perPage: "1000" }).perPage).toBe(10);
    expect(parsePagination({ perPage: "abc" }).perPage).toBe(10);
  });

  it("URLSearchParams 입력도 처리한다", () => {
    const params = new URLSearchParams({ page: "3", perPage: "20" });
    expect(parsePagination(params)).toEqual({ page: 3, perPage: 20 });
  });

  it("defaults가 주어지면 query가 없을 때 defaults를 사용한다", () => {
    expect(parsePagination({}, { page: 2, perPage: 20 })).toEqual({ page: 2, perPage: 20 });
  });
});

describe("clampPage", () => {
  it("totalPages보다 큰 page는 totalPages로 보정한다", () => {
    expect(clampPage(10, 5)).toBe(5);
  });

  it("1보다 작은 page는 1로 보정한다", () => {
    expect(clampPage(0, 5)).toBe(1);
    expect(clampPage(-1, 5)).toBe(1);
  });

  it("totalPages가 0이면 1을 반환한다", () => {
    expect(clampPage(3, 0)).toBe(1);
  });

  it("유효 범위의 page는 그대로 반환한다", () => {
    expect(clampPage(3, 5)).toBe(3);
  });
});

describe("getOffset", () => {
  it("page 1은 offset 0이다", () => {
    expect(getOffset(1, 10)).toBe(0);
  });

  it("page 3, perPage 10이면 offset 20이다", () => {
    expect(getOffset(3, 10)).toBe(20);
  });
});

describe("buildPaginationInfo", () => {
  it("totalPages를 올바르게 계산한다", () => {
    expect(buildPaginationInfo(43, 1, 10).totalPages).toBe(5);
    expect(buildPaginationInfo(0, 1, 10).totalPages).toBe(1);
    expect(buildPaginationInfo(10, 1, 10).totalPages).toBe(1);
  });

  it("hasNextPage/hasPreviousPage를 올바르게 계산한다", () => {
    const first = buildPaginationInfo(43, 1, 10);
    expect(first.hasPreviousPage).toBe(false);
    expect(first.hasNextPage).toBe(true);

    const last = buildPaginationInfo(43, 5, 10);
    expect(last.hasPreviousPage).toBe(true);
    expect(last.hasNextPage).toBe(false);
  });

  it("범위를 벗어난 page는 보정된다", () => {
    expect(buildPaginationInfo(43, 999, 10).page).toBe(5);
  });
});

describe("paginateItems", () => {
  it("page/perPage로 배열을 자른다", () => {
    const items = Array.from({ length: 25 }, (_, i) => i + 1);
    const { items: page1, pagination } = paginateItems(items, 1, 10);
    expect(page1).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(pagination.totalPages).toBe(3);

    const { items: page3 } = paginateItems(items, 3, 10);
    expect(page3).toEqual([21, 22, 23, 24, 25]);
  });
});

describe("buildPageUrl", () => {
  it("기존 query를 유지한 채 page만 교체한다", () => {
    const params = new URLSearchParams({ platform: "wordpress_blog", perPage: "20", page: "1" });
    const url = buildPageUrl("/articles/a1/blog", params, 3);
    expect(url).toContain("page=3");
    expect(url).toContain("platform=wordpress_blog");
    expect(url).toContain("perPage=20");
  });

  it("plain object 형태의 searchParams도 처리한다", () => {
    const url = buildPageUrl("/articles/a1/blog", { socialPostId: "abc" }, 2);
    expect(url).toBe("/articles/a1/blog?socialPostId=abc&page=2");
  });

  it("query가 없으면 page만 붙인다", () => {
    expect(buildPageUrl("/articles/a1/blog", {}, 1)).toBe("/articles/a1/blog?page=1");
  });
});

describe("findItemPage", () => {
  it("항목이 있는 page 번호를 계산한다", () => {
    const items = Array.from({ length: 25 }, (_, i) => ({ id: `p${i + 1}` }));
    expect(findItemPage(items, (item) => item.id === "p1", 10)).toBe(1);
    expect(findItemPage(items, (item) => item.id === "p11", 10)).toBe(2);
    expect(findItemPage(items, (item) => item.id === "p25", 10)).toBe(3);
  });

  it("항목을 찾지 못하면 null을 반환한다", () => {
    const items = [{ id: "p1" }];
    expect(findItemPage(items, (item) => item.id === "missing", 10)).toBeNull();
  });
});
