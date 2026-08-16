import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const pageSource = readFileSync(path.join(__dirname, "page.tsx"), "utf8");

describe("platform API dashboard page (정적 소스 검사, Phase 3-21)", () => {
  it("capability matrix와 readiness를 함께 렌더링한다", () => {
    expect(pageSource).toContain("listPlatformApiCapabilities");
    expect(pageSource).toContain("checkPlatformApiReadiness");
    expect(pageSource).toContain("ApiReadinessBadge");
  });

  it("실제 게시가 아니라 준비 단계 확인이라는 안내를 표시한다", () => {
    expect(pageSource).toContain("실제 API 게시가 아니라");
    expect(pageSource).toContain("비활성화되어 있습니다");
  });

  it("환경변수 값을 직접 출력하지 않는다 (process.env 직접 참조 없음)", () => {
    expect(pageSource).not.toContain("process.env");
  });

  it("actual publish 버튼(실제 게시 실행)을 만들지 않는다", () => {
    expect(pageSource).not.toContain("실제 게시 실행");
    expect(pageSource).not.toMatch(/action=\{.*[Pp]ublish.*Action\}/);
  });
});
