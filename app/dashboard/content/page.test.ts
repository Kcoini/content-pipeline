import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const pageSource = readFileSync(path.join(__dirname, "page.tsx"), "utf8");

describe("content dashboard page 한국어 제목 (정적 소스 검사, Phase 3-24)", () => {
  it("h1 제목이 한국어다(영어 'Content Dashboard'가 아니다)", () => {
    expect(pageSource).not.toContain("Content Dashboard");
    expect(pageSource).toMatch(/<h1 className="text-2xl font-bold">콘텐츠 현황<\/h1>/);
  });

  it("이 화면에서 할 수 있는 일을 한 문장으로 안내한다", () => {
    expect(pageSource).toContain("전체 테마, 출처, 원고, 플랫폼 글의 진행 상태를 한눈에 확인합니다.");
  });

  it("영어 섹션 제목(Summary)이 한국어로 바뀐다", () => {
    expect(pageSource).not.toMatch(/<h2 className="text-sm font-semibold text-zinc-700">Summary<\/h2>/);
  });
});
