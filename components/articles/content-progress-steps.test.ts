import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const source = readFileSync(path.join(__dirname, "content-progress-steps.tsx"), "utf8");

describe("ContentProgressSteps (정적 소스 검사, Phase 3-22)", () => {
  it("5단계(테마 선택/출처 입력/글 생성/검토·승인/게시 준비)를 정의한다", () => {
    expect(source).toContain("테마 선택");
    expect(source).toContain("출처 입력");
    expect(source).toContain("글 생성");
    expect(source).toContain("검토/승인");
    expect(source).toContain("게시 준비");
  });

  it("개발자용 상태값(quality_status 등)을 props나 렌더링 로직에서 참조하지 않는다(주석 설명 제외)", () => {
    const codeOnly = source.replace(/\/\/.*$/gm, "");
    expect(codeOnly).not.toMatch(/quality_status|approval_status|export_status/);
  });

  it("현재 단계를 다른 스타일로 강조한다", () => {
    expect(source).toContain("isCurrent");
    expect(source).toContain("bg-indigo-600");
  });
});
