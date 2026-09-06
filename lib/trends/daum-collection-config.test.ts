import { afterEach, describe, expect, it, vi } from "vitest";
import { getDaumSearchPageSize, getDaumSearchMaxPages } from "./daum-collection-config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getDaumSearchPageSize", () => {
  it("환경변수가 없으면 기본값 10을 반환한다", () => {
    vi.stubEnv("DAUM_SEARCH_PAGE_SIZE", "");
    expect(getDaumSearchPageSize()).toBe(10);
  });

  it("환경변수 값을 반영한다", () => {
    vi.stubEnv("DAUM_SEARCH_PAGE_SIZE", "20");
    expect(getDaumSearchPageSize()).toBe(20);
  });

  it("유효하지 않은 값이면 기본값을 반환한다", () => {
    vi.stubEnv("DAUM_SEARCH_PAGE_SIZE", "not-a-number");
    expect(getDaumSearchPageSize()).toBe(10);
  });
});

describe("getDaumSearchMaxPages", () => {
  it("환경변수가 없으면 기본값 1을 반환한다", () => {
    vi.stubEnv("DAUM_SEARCH_MAX_PAGES", "");
    expect(getDaumSearchMaxPages()).toBe(1);
  });

  it("환경변수 값을 반영한다", () => {
    vi.stubEnv("DAUM_SEARCH_MAX_PAGES", "3");
    expect(getDaumSearchMaxPages()).toBe(3);
  });

  it("5보다 큰 값은 5로 제한한다(과도한 API 호출 방지)", () => {
    vi.stubEnv("DAUM_SEARCH_MAX_PAGES", "100");
    expect(getDaumSearchMaxPages()).toBe(5);
  });
});
