import { describe, expect, it } from "vitest";
import { formatThreadItemsForCopy } from "./thread-item-formatter";

describe("formatThreadItemsForCopy", () => {
  it("order 순서대로 빈 줄로 구분해 이어붙인다", () => {
    const text = formatThreadItemsForCopy([
      { order: 2, text: "두 번째" },
      { order: 1, text: "첫 번째" },
    ]);
    expect(text).toBe("첫 번째\n\n두 번째");
  });

  it("빈 항목은 제외한다", () => {
    const text = formatThreadItemsForCopy([
      { order: 1, text: "첫 번째" },
      { order: 2, text: "   " },
      { order: 3, text: "세 번째" },
    ]);
    expect(text).toBe("첫 번째\n\n세 번째");
  });

  it("항목이 없으면 빈 문자열을 반환한다", () => {
    expect(formatThreadItemsForCopy([])).toBe("");
  });

  it("각 항목의 앞뒤 공백을 제거한다", () => {
    const text = formatThreadItemsForCopy([{ order: 1, text: "  공백 포함  " }]);
    expect(text).toBe("공백 포함");
  });
});
