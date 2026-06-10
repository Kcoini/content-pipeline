import { describe, expect, it } from "vitest";
import { summarizeSourcesMock, summarizeSourcesWithAi } from "./source-summarizer";
import type { Source } from "@/lib/types/domain";

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
  it("아직 구현되지 않아 호출 시 에러를 던진다", async () => {
    await expect(summarizeSourcesWithAi(sources)).rejects.toThrow();
  });
});
