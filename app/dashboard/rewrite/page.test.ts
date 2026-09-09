import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const pageSource = readFileSync(path.join(__dirname, "page.tsx"), "utf8");

describe("rewrite dashboard page 한국어 제목/라벨 (정적 소스 검사, Phase 3-24)", () => {
  it("h1 제목이 한국어다(영어 'Rewrite Dashboard'가 아니다)", () => {
    expect(pageSource).not.toContain("Rewrite Dashboard");
    expect(pageSource).toMatch(/<h1 className="text-2xl font-bold">재작성 관리<\/h1>/);
  });

  it("이 화면에서 할 수 있는 일을 한 문장으로 안내한다", () => {
    expect(pageSource).toContain("성과가 낮거나 개선이 필요한 글의 재작성 제안과 버전을 관리합니다.");
  });

  it("영어 섹션 제목(Rewrite Versions)이 한국어로 바뀐다", () => {
    expect(pageSource).not.toContain("Rewrite Versions (");
    expect(pageSource).toContain("재작성 버전 (");
  });

  it("필터 select와 테이블은 raw enum이 아니라 라벨을 표시한다", () => {
    expect(pageSource).toContain("{PLATFORM_LABELS[p]}");
    expect(pageSource).toContain("describeStatusValue(p.versionComparisonStatus)");
  });
});
