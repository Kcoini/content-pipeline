import { describe, expect, it } from "vitest";
import { mapThemeRowToTheme } from "./theme-repository";
import type { ThemeRow } from "@/lib/supabase/database.types";

function makeThemeRow(overrides: Partial<ThemeRow> = {}): ThemeRow {
  return {
    id: "theme-1",
    title: "AI 에이전트 동향",
    description: "설명",
    keywords: ["AI", "에이전트"],
    language: "ko",
    status: "draft",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("mapThemeRowToTheme", () => {
  it("themes row를 Theme으로 변환한다", () => {
    const theme = mapThemeRowToTheme(makeThemeRow());

    expect(theme).toEqual({
      id: "theme-1",
      title: "AI 에이전트 동향",
      description: "설명",
      keywords: ["AI", "에이전트"],
      language: "ko",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("description이 null이면 빈 문자열로, language가 ko/en이 아니면 ko로 처리한다", () => {
    const theme = mapThemeRowToTheme(
      makeThemeRow({ description: null, language: "fr", keywords: [] })
    );

    expect(theme.description).toBe("");
    expect(theme.language).toBe("ko");
    expect(theme.keywords).toEqual([]);
  });
});
