import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const pageSource = readFileSync(path.join(__dirname, "page.tsx"), "utf8");

describe("social performance dashboard page 한국어 제목 (정적 소스 검사, Phase 3-24)", () => {
  it("h1 제목이 한국어다(영어 'Social Performance Dashboard'가 아니다)", () => {
    expect(pageSource).not.toContain("Social Performance Dashboard");
    expect(pageSource).toMatch(/<h1 className="text-2xl font-bold">소셜 성과 분석<\/h1>/);
  });

  it("이 화면에서 할 수 있는 일을 한 문장으로 안내한다", () => {
    expect(pageSource).toContain("네이버 카페, X, Threads, Instagram 등 여러 플랫폼 글의 반응을 비교합니다.");
  });

  it("다른 서브 대시보드로 가는 nav 라벨도 한국어다", () => {
    expect(pageSource).not.toContain("Content Dashboard");
    expect(pageSource).not.toContain("Blog Dashboard");
    expect(pageSource).not.toContain("Rewrite Dashboard");
    expect(pageSource).toContain("콘텐츠 현황");
    expect(pageSource).toContain("블로그 현황");
    expect(pageSource).toContain("재작성 관리");
  });

  it("영어 차트 제목(Chart Overview 등)이 한국어로 바뀐다", () => {
    expect(pageSource).not.toContain("Chart Overview");
    expect(pageSource).not.toContain('title="Platform Performance"');
    expect(pageSource).toContain("성과 요약");
    expect(pageSource).toContain('title="플랫폼별 성과"');
  });
});
