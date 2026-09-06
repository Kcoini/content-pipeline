import { describe, expect, it } from "vitest";
import { filterThemesByQuery } from "./theme-search";

const items = [{ title: "AI 산업 동향" }, { title: "반도체 수출 동향" }, { title: "전기차 배터리" }];
const getTitle = (item: { title: string }) => item.title;

describe("filterThemesByQuery", () => {
  it("검색어가 비어 있으면 전체를 반환한다", () => {
    expect(filterThemesByQuery(items, "", getTitle)).toEqual(items);
    expect(filterThemesByQuery(items, "   ", getTitle)).toEqual(items);
  });

  it("제목에 검색어가 포함된 항목만 남긴다", () => {
    expect(filterThemesByQuery(items, "동향", getTitle)).toEqual([{ title: "AI 산업 동향" }, { title: "반도체 수출 동향" }]);
  });

  it("대소문자를 구분하지 않는다", () => {
    expect(filterThemesByQuery(items, "ai", getTitle)).toEqual([{ title: "AI 산업 동향" }]);
  });

  it("일치하는 항목이 없으면 빈 배열을 반환한다", () => {
    expect(filterThemesByQuery(items, "존재하지않는키워드", getTitle)).toEqual([]);
  });

  it("중첩된 항목(theme.title)에도 accessor를 통해 재사용할 수 있다", () => {
    const wrapped = [{ theme: { title: "AI 산업 동향" } }, { theme: { title: "반도체 수출 동향" } }];
    const result = filterThemesByQuery(wrapped, "반도체", (item) => item.theme.title);
    expect(result).toEqual([{ theme: { title: "반도체 수출 동향" } }]);
  });
});
