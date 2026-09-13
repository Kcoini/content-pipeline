import { describe, expect, it } from "vitest";
import { formatRelativeTimeFromNow } from "./relative-time";

describe("formatRelativeTimeFromNow", () => {
  const now = new Date("2026-01-01T00:10:00.000Z");

  it("null/undefined면 '알 수 없음'을 반환한다", () => {
    expect(formatRelativeTimeFromNow(null, now)).toBe("알 수 없음");
    expect(formatRelativeTimeFromNow(undefined, now)).toBe("알 수 없음");
  });

  it("5초 미만이면 '방금 전'을 반환한다", () => {
    expect(formatRelativeTimeFromNow("2026-01-01T00:09:58.000Z", now)).toBe("방금 전");
  });

  it("초 단위로 반환한다", () => {
    expect(formatRelativeTimeFromNow("2026-01-01T00:09:48.000Z", now)).toBe("12초 전");
  });

  it("분 단위로 반환한다", () => {
    expect(formatRelativeTimeFromNow("2026-01-01T00:07:00.000Z", now)).toBe("3분 전");
  });

  it("시간 단위로 반환한다", () => {
    expect(formatRelativeTimeFromNow("2025-12-31T22:10:00.000Z", now)).toBe("2시간 전");
  });

  it("일 단위로 반환한다", () => {
    expect(formatRelativeTimeFromNow("2025-12-29T00:10:00.000Z", now)).toBe("3일 전");
  });
});
