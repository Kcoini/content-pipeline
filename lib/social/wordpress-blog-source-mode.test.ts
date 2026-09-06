import { describe, expect, it } from "vitest";
import { classifyWordPressBlogSourceMode, countUsableSources, isUsableSource } from "./wordpress-blog-source-mode";

describe("isUsableSource", () => {
  it("summary가 있으면 usable하다", () => {
    expect(isUsableSource({ summary: "요약입니다", keyPoints: [] })).toBe(true);
  });

  it("keyPoints가 있으면 usable하다", () => {
    expect(isUsableSource({ summary: "", keyPoints: ["핵심 1"] })).toBe(true);
  });

  it("summary/keyPoints가 모두 없으면 usable하지 않다", () => {
    expect(isUsableSource({ summary: "", keyPoints: [] })).toBe(false);
    expect(isUsableSource({ summary: "   ", keyPoints: [] })).toBe(false);
  });
});

describe("countUsableSources", () => {
  it("usable한 출처만 센다", () => {
    const sources = [
      { summary: "요약", keyPoints: [] },
      { summary: "", keyPoints: [] },
      { summary: "", keyPoints: ["포인트"] },
    ];
    expect(countUsableSources(sources)).toBe(2);
  });
});

describe("classifyWordPressBlogSourceMode", () => {
  it("0개면 no_source다", () => {
    expect(classifyWordPressBlogSourceMode(0)).toBe("no_source");
  });

  it("1개면 single_source다", () => {
    expect(classifyWordPressBlogSourceMode(1)).toBe("single_source");
  });

  it("2개 이상이면 multi_source다", () => {
    expect(classifyWordPressBlogSourceMode(2)).toBe("multi_source");
    expect(classifyWordPressBlogSourceMode(5)).toBe("multi_source");
  });
});
