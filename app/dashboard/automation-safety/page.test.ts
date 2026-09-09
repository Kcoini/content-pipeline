import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const pageSource = readFileSync(path.join(__dirname, "page.tsx"), "utf8");
const actionsSource = readFileSync(path.join(__dirname, "actions.ts"), "utf8");

describe("automation safety review dashboard page (정적 소스 검사, Phase 3-22)", () => {
  it("runAutomationSafetyReview를 호출해 전체 결과를 렌더링한다", () => {
    expect(pageSource).toContain("runAutomationSafetyReview");
    expect(pageSource).toContain("categoryResults");
    expect(pageSource).toContain("checklist");
    expect(pageSource).toContain("recommendations");
  });

  it("점검 전용이며 데이터를 자동 수정하지 않는다는 안내를 표시한다", () => {
    expect(pageSource).toContain("이 페이지는 점검 전용이며 데이터를 자동 수정하지 않습니다.");
  });

  it("실제 게시 버튼을 만들지 않고, 자동 수정을 하지 않는다는 안내를 포함한다", () => {
    expect(pageSource).not.toContain("실제 게시 실행");
    expect(pageSource).not.toMatch(/action=\{.*[Pp]ublish.*Action\}/);
    expect(pageSource).toContain("자동 수정 버튼은 제공하지 않습니다");
  });

  it("환경변수 값을 직접 출력하지 않는다 (process.env 직접 참조 없음)", () => {
    expect(pageSource).not.toContain("process.env");
  });

  it("Safety Review 실행 등 점검용 버튼을 제공한다", () => {
    expect(pageSource).toContain("Safety Review 실행");
    expect(pageSource).toContain("최근 로그 보안 점검");
    expect(pageSource).toContain("게시 workflow 점검");
    expect(pageSource).toContain("feature flag 점검");
  });

  it("actions.ts는 데이터를 변경하지 않고 페이지만 재검증한다", () => {
    expect(actionsSource).toContain("revalidatePath");
    expect(actionsSource).not.toMatch(/update|insert|delete/i);
  });
});

describe("automation safety review dashboard page 한국어 제목 (정적 소스 검사, Phase 3-24)", () => {
  it("h1 제목이 한국어다(영어 'Automation Safety Review'가 아니다)", () => {
    expect(pageSource).not.toContain("Automation Safety Review");
    expect(pageSource).toMatch(/<h1 className="text-2xl font-bold">자동화 안전 점검<\/h1>/);
  });

  it("이 화면에서 할 수 있는 일을 한 문장으로 안내한다", () => {
    expect(pageSource).toContain("자동화 기능이 공개 게시나 민감정보 노출로 이어지지 않도록 점검합니다.");
  });

  it("카테고리 라벨이 한국어다", () => {
    expect(pageSource).toContain('feature_flags: "기능 플래그"');
    expect(pageSource).not.toContain('feature_flags: "Feature Flags"');
  });
});
