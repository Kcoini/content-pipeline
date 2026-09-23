import "./load-env";
import { describe, it, expect } from "vitest";
import { runProductionPreflight } from "@/lib/ops/production-preflight";

const STATUS_LABEL: Record<string, string> = { pass: "PASS", warning: "WARNING", fail: "FAIL" };

function printReport(): void {
  const result = runProductionPreflight();

  console.log("\nProduction Preflight\n");
  for (const check of result.checks) {
    console.log(`${check.name.padEnd(20)} ${STATUS_LABEL[check.status]}`);
    if (check.status !== "pass") console.log(`  → ${check.message}`);
  }

  const criticalFlags = result.dangerousFlags.filter((f) => f.status === "critical");
  if (criticalFlags.length > 0) {
    console.log("\n위험 flag:");
    for (const f of criticalFlags) console.log(`  - ${f.flagName}: ${f.message}`);
  }

  const overallLabel =
    result.overall === "pass" ? "PASS" : result.overall === "warning" ? "PASS WITH WARNINGS" : "FAIL";
  console.log(`\nOverall: ${overallLabel}\n`);
}

// npm run ops:preflight로 실행하는 CLI. 이 프로젝트에 이미 확립된
// "vitest를 스크립트 러너로 쓰는" 패턴(scripts/ops-01/)을 그대로
// 따른다 — 새 CLI 프레임워크를 추가하지 않는다. 테스트 자체는 결과
// 구조가 유효한지만 확인하고, 실제 사람이 보는 리포트는 console.log로
// 출력한다.
describe("ops:preflight", () => {
  it("prints a production preflight report and returns a well-formed result", () => {
    printReport();
    const result = runProductionPreflight();
    expect(["pass", "warning", "fail"]).toContain(result.overall);
    expect(result.checks.length).toBeGreaterThan(0);
  });
});
