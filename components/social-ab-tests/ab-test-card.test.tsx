import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const componentSource = readFileSync(path.join(__dirname, "ab-test-card.tsx"), "utf8");

describe("AbTestCard (정적 소스 검사, Phase UX-04B: H3 raw enum 라벨 정리)", () => {
  it("'ready로 변경'/'running 시작' 같은 raw enum이 섞인 버튼 라벨을 쓰지 않는다", () => {
    expect(componentSource).not.toContain("ready로 변경");
    expect(componentSource).not.toContain("running 시작");
    expect(componentSource).toContain("테스트 준비 완료로 표시");
    expect(componentSource).toContain("테스트 시작");
  });

  it("testStatus 배지는 raw enum을 그대로 렌더링하지 않고 TEST_STATUS_LABELS로 변환한다", () => {
    expect(componentSource).not.toMatch(/\{abTest\.testStatus\}\s*<\/span>/);
    expect(componentSource).toContain("TEST_STATUS_LABELS[abTest.testStatus]");
  });

  it("각 상태 전환 action의 disabled 조건은 그대로 유지한다(라벨만 바뀌었다)", () => {
    expect(componentSource).toContain('disabled={abTest.testStatus !== "draft"}');
    expect(componentSource).toContain('disabled={abTest.testStatus !== "ready" && abTest.testStatus !== "paused"}');
  });
});
