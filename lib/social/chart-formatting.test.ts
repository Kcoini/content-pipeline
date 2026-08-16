import { describe, expect, it } from "vitest";
import { formatChartNumber, formatPercentage, formatScore, formatMonthLabel, normalizeChartValue, safeAverage } from "./chart-formatting";

describe("formatChartNumber", () => {
  it("숫자를 천 단위 구분 기호로 표시한다", () => {
    expect(formatChartNumber(1234)).toBe("1,234");
  });

  it("null/undefined는 '-'로 표시한다", () => {
    expect(formatChartNumber(null)).toBe("-");
    expect(formatChartNumber(undefined)).toBe("-");
  });

  it("0은 '0'으로 표시한다", () => {
    expect(formatChartNumber(0)).toBe("0");
  });
});

describe("formatPercentage", () => {
  it("0~1 사이 비율을 %로 표시한다", () => {
    expect(formatPercentage(0.755)).toBe("75.5%");
  });

  it("null/undefined는 '-'로 표시한다", () => {
    expect(formatPercentage(null)).toBe("-");
    expect(formatPercentage(undefined)).toBe("-");
  });
});

describe("formatScore", () => {
  it("소수점 1자리로 표시한다", () => {
    expect(formatScore(72.345)).toBe("72.3");
  });

  it("null/undefined는 '-'로 표시한다", () => {
    expect(formatScore(null)).toBe("-");
    expect(formatScore(undefined)).toBe("-");
  });
});

describe("formatMonthLabel", () => {
  it("YYYY-MM 문자열을 'N년 M월'로 바꾼다", () => {
    expect(formatMonthLabel("2026-01")).toBe("2026년 1월");
    expect(formatMonthLabel("2026-11-05")).toBe("2026년 11월");
  });

  it("형식에 맞지 않으면 원본을 그대로 반환한다", () => {
    expect(formatMonthLabel("invalid")).toBe("invalid");
  });
});

describe("normalizeChartValue", () => {
  it("max 기준 0~100 비율로 정규화한다", () => {
    expect(normalizeChartValue(50, 100)).toBe(50);
    expect(normalizeChartValue(100, 100)).toBe(100);
  });

  it("value가 max를 넘으면 100으로 clamp한다", () => {
    expect(normalizeChartValue(150, 100)).toBe(100);
  });

  it("max가 0 이하이면 0을 반환한다", () => {
    expect(normalizeChartValue(50, 0)).toBe(0);
    expect(normalizeChartValue(50, -10)).toBe(0);
  });

  it("null/undefined value는 0을 반환한다", () => {
    expect(normalizeChartValue(null, 100)).toBe(0);
    expect(normalizeChartValue(undefined, 100)).toBe(0);
  });
});

describe("safeAverage", () => {
  it("숫자 배열의 평균을 계산한다", () => {
    expect(safeAverage([1, 2, 3])).toBe(2);
  });

  it("null/undefined 값을 건너뛰고 평균을 계산한다", () => {
    expect(safeAverage([10, null, 20, undefined])).toBe(15);
  });

  it("빈 배열이거나 유효한 값이 없으면 null을 반환한다", () => {
    expect(safeAverage([])).toBeNull();
    expect(safeAverage([null, undefined])).toBeNull();
  });
});
