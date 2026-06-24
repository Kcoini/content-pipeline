import { describe, expect, it, vi, afterEach } from "vitest";
import { generateSourceSummaryMock, generateSourceSummaryWithAi } from "./source-auto-summarizer";
import type { Source } from "@/lib/types/domain";

afterEach(() => {
  vi.unstubAllGlobals();
});

const baseSource: Source = {
  id: "source-1",
  themeId: "theme-1",
  url: "https://example.com/article",
  title: "테스트 출처",
  publisher: "테스트 매체",
  publishedAt: "2026-01-01",
  summary: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  fetchStatus: "success",
  fetchError: null,
  rawContent: "이것은 테스트 본문입니다. 핵심 내용이 여기 있습니다.",
  summaryStatus: "pending",
  summaryError: null,
  summarizedAt: null,
  keyPoints: [],
};

// ─── generateSourceSummaryMock ────────────────────────────────────────────────

describe("generateSourceSummaryMock", () => {
  it("summary가 있으면 summary를 기반으로 mock 결과를 반환한다", () => {
    const source = { ...baseSource, summary: "기존 요약 내용입니다." };
    const result = generateSourceSummaryMock(source);

    expect(result.summary).toContain("기존 요약");
    expect(Array.isArray(result.keyPoints)).toBe(true);
    expect(result.keyPoints.length).toBeGreaterThan(0);
    expect(result.entities).toEqual([]);
    expect(result.risksOrUncertainties).toEqual([]);
  });

  it("summary가 없고 rawContent가 있으면 rawContent를 사용한다", () => {
    const source = { ...baseSource, summary: "", rawContent: "본문 내용입니다." };
    const result = generateSourceSummaryMock(source);

    expect(result.summary).toContain("본문 내용");
  });

  it("summary와 rawContent가 없으면 제목+출판사로 대체한다", () => {
    const source = { ...baseSource, summary: "", rawContent: null };
    const result = generateSourceSummaryMock(source);

    expect(result.summary).toContain("테스트 출처");
    expect(result.summary).toContain("테스트 매체");
  });

  it("key_points는 배열로 반환된다", () => {
    const result = generateSourceSummaryMock(baseSource);
    expect(Array.isArray(result.keyPoints)).toBe(true);
  });
});

// ─── generateSourceSummaryWithAi ─────────────────────────────────────────────

describe("generateSourceSummaryWithAi", () => {
  it("ANTHROPIC_API_KEY가 없으면 오류를 던진다", async () => {
    const original = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    await expect(generateSourceSummaryWithAi(baseSource, "raw content")).rejects.toThrow(
      /ANTHROPIC_API_KEY/
    );

    if (original !== undefined) process.env.ANTHROPIC_API_KEY = original;
  });

  it("AI가 tool_use로 구조화된 결과를 반환하면 SourceSummaryResult를 반환한다", async () => {
    const mockResponse = {
      content: [
        {
          type: "tool_use",
          id: "tool-1",
          name: "save_source_summary",
          input: {
            summary: "AI가 생성한 요약입니다.",
            key_points: ["포인트 1", "포인트 2"],
            entities: ["기관A"],
            risks_or_uncertainties: ["불확실성1"],
            source_angle: "분석적 관점",
          },
        },
      ],
      stop_reason: "tool_use",
    };
    process.env.ANTHROPIC_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
    );

    const result = await generateSourceSummaryWithAi(baseSource, "테스트 본문");

    expect(result.summary).toBe("AI가 생성한 요약입니다.");
    expect(result.keyPoints).toEqual(["포인트 1", "포인트 2"]);
    expect(result.entities).toEqual(["기관A"]);
    expect(result.risksOrUncertainties).toEqual(["불확실성1"]);
    expect(result.sourceAngle).toBe("분석적 관점");
  });

  it("ANTHROPIC_API_KEY가 있으면 함수를 호출할 수 있다 (실제 API 호출은 하지 않음)", () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    // 함수가 존재하고 호출 가능한지 확인 (실제 AI 호출은 테스트하지 않음)
    expect(typeof generateSourceSummaryWithAi).toBe("function");
  });
});

// ─── fallback 우선순위 ────────────────────────────────────────────────────────

describe("generateSourceSummaryMock fallback 순서", () => {
  it("rawContent가 있으면 summary보다 rawContent를 fallback으로 사용한다", () => {
    const source = { ...baseSource, summary: "", rawContent: "raw 본문" };
    const result = generateSourceSummaryMock(source);
    expect(result.summary).toContain("raw 본문");
  });

  it("rawContent가 없으면 제목+출판사 fallback을 사용한다", () => {
    const source = { ...baseSource, summary: "", rawContent: null };
    const result = generateSourceSummaryMock(source);
    expect(result.summary).toMatch(/테스트 출처/);
  });
});
