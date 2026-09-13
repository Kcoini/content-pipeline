import { describe, expect, it } from "vitest";
import { asArray } from "./safe-array";

describe("asArray", () => {
  it("실제 배열이면 그대로(복사본) 반환한다", () => {
    const input = [1, 2, 3];
    const result = asArray(input);
    expect(result).toEqual([1, 2, 3]);
    expect(result).not.toBe(input);
  });

  it("undefined/null이면 빈 배열을 반환한다", () => {
    expect(asArray(undefined)).toEqual([]);
    expect(asArray(null)).toEqual([]);
  });

  it("객체나 문자열처럼 배열이 아닌 값이어도 빈 배열을 반환한다(런타임 방어)", () => {
    expect(asArray({} as never)).toEqual([]);
    expect(asArray("문자열" as never)).toEqual([]);
  });

  it("빈 배열은 그대로 빈 배열을 반환한다", () => {
    expect(asArray([])).toEqual([]);
  });
});
