import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const pageSource = readFileSync(path.join(__dirname, "page.tsx"), "utf8");

describe("blog dashboard page 한국어 제목/라벨 (정적 소스 검사, Phase 3-24)", () => {
  it("h1 제목이 한국어다(영어 'Blog Dashboard'가 아니다)", () => {
    expect(pageSource).not.toContain("Blog Dashboard");
    expect(pageSource).toMatch(/<h1 className="text-2xl font-bold">블로그 현황<\/h1>/);
  });

  it("이 화면에서 할 수 있는 일을 한 문장으로 안내한다", () => {
    expect(pageSource).toContain("WordPress와 네이버 블로그 글의 생성, 검토, 게시 준비 상태를 확인합니다.");
  });

  it("필터 select와 테이블은 raw enum이 아니라 PLATFORM_LABELS/describeStatusValue로 표시한다", () => {
    expect(pageSource).toContain('import { PLATFORM_LABELS } from "@/lib/social/platform-generation-recommendations"');
    expect(pageSource).toContain('import { describeStatusValue, describeStatusField } from "@/lib/social/status-labels"');
    expect(pageSource).toContain("{PLATFORM_LABELS[p]}");
    expect(pageSource).toContain("describeStatusValue(p.qualityStatus)");
  });

  it("영어 섹션 제목(Blog Posts)이 한국어로 바뀐다", () => {
    expect(pageSource).not.toContain("Blog Posts (");
    expect(pageSource).toContain("블로그 글 목록 (");
  });
});
