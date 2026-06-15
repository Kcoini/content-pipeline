import { describe, expect, it } from "vitest";
import { summarizeSourcesMock, summarizeSourcesWithAi } from "./source-summarizer";
import type { Source, Theme } from "@/lib/types/domain";

const theme: Theme = {
  id: "theme-1",
  title: "AI 에이전트 동향",
  description: "2026년 AI 에이전트 관련 최신 동향을 정리한다.",
  keywords: ["AI", "에이전트"],
  language: "ko",
  createdAt: new Date().toISOString(),
};

const sources: Source[] = [
  {
    id: "source-1",
    themeId: "theme-1",
    url: "https://a.example.com",
    title: "출처 A",
    publisher: "A 매체",
    publishedAt: "2026-01-01",
    summary: "출처 A 요약",
    createdAt: new Date().toISOString(),
  },
  {
    id: "source-2",
    themeId: "theme-1",
    url: "https://b.example.com",
    title: "출처 B",
    publisher: "B 매체",
    publishedAt: "2026-02-01",
    summary: "",
    createdAt: new Date().toISOString(),
  },
];

describe("summarizeSourcesMock", () => {
  it("등록된 summary가 있으면 그대로 사용한다", () => {
    const [first] = summarizeSourcesMock(sources);

    expect(first).toEqual({
      sourceId: "source-1",
      title: "출처 A",
      url: "https://a.example.com",
      publisher: "A 매체",
      publishedAt: "2026-01-01",
      summary: "출처 A 요약",
    });
  });

  it("summary가 비어 있으면 제목/출판사 기반 대체 문구를 만든다", () => {
    const [, second] = summarizeSourcesMock(sources);

    expect(second.summary).toBe("출처 B (B 매체)");
  });
});

describe("summarizeSourcesWithAi", () => {
  it("ANTHROPIC_API_KEY가 없으면 명확한 오류를 던진다", async () => {
    const original = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    await expect(summarizeSourcesWithAi(theme, sources)).rejects.toThrow(
      /ANTHROPIC_API_KEY/
    );

    if (original !== undefined) process.env.ANTHROPIC_API_KEY = original;
  });
});
