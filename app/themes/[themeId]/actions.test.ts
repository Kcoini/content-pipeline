// Phase 3-27: "관련 기사 URL 수집" 버튼 클릭 후 무반응 문제를 고치기 위한
// action 변경을 정적 소스 검사로 고정한다. 이 프로젝트는 redirect()가
// 실제로 예외를 던지는 server action을 직접 실행해서 테스트하는 대신,
// 소스 텍스트를 검사하는 방식을 관례로 쓴다(`app/articles/[id]/actions.test.ts` 참고).

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const actionsSource = readFileSync(path.join(__dirname, "actions.ts"), "utf8");

describe("collectCandidates (Phase 3-27)", () => {
  it("더 이상 반환값을 조용히 버리는 형태가 아니라 FormData를 받는 top-level action이다", () => {
    expect(actionsSource).toContain("export async function collectCandidates(formData: FormData): Promise<void>");
  });

  it("결과를 query string에 담아 같은 페이지로 redirect한다(무반응 방지)", () => {
    expect(actionsSource).toContain("collectStatus");
    expect(actionsSource).toContain("collectNew");
    expect(actionsSource).toContain("collectDup");
    expect(actionsSource).toMatch(/redirect\(`\/themes\/\$\{themeId\}\?\$\{params\.toString\(\)\}#collection-result`\)/);
  });

  it("성공/부분성공/결과없음/실패 4가지 상태를 모두 계산한다", () => {
    expect(actionsSource).toContain('status = "none"');
    expect(actionsSource).toContain('status = "partial"');
    expect(actionsSource).toContain('status = "success"');
    expect(actionsSource).toContain('status = "error"');
  });

  it("started/completed/failed/no_results/partial_success/add_more_clicked 이벤트를 기록한다", () => {
    expect(actionsSource).toContain('type: "related_url_collection_started"');
    expect(actionsSource).toContain('type: "related_url_collection_completed"');
    expect(actionsSource).toContain('type: "related_url_collection_failed"');
    expect(actionsSource).toContain('type: "related_url_collection_no_results"');
    expect(actionsSource).toContain('type: "related_url_collection_partial_success"');
    expect(actionsSource).toContain('type: "related_url_collection_add_more_clicked"');
  });

  it("로그에 API key/토큰/raw full API 응답을 남기지 않는다", () => {
    expect(actionsSource).not.toContain("apiKey");
    expect(actionsSource).not.toContain("Authorization");
    expect(actionsSource).not.toMatch(/details:\s*\{[^}]*rawContent/);
  });
});

describe("결과 화면의 다음 행동 action들 (Phase 3-27)", () => {
  it("finishUrlCollection은 종료 이벤트를 기록하고 collectStatus=finished로 돌아온다", () => {
    expect(actionsSource).toContain("export async function finishUrlCollection(formData: FormData): Promise<void>");
    expect(actionsSource).toContain('type: "related_url_collection_finished_by_user"');
    expect(actionsSource).toContain("collectStatus=finished");
  });

  it("goDashboardFromUrlCollection은 이동 이벤트를 기록하고 /dashboard로 이동한다(외부 URL 아님)", () => {
    expect(actionsSource).toContain("export async function goDashboardFromUrlCollection(formData: FormData): Promise<void>");
    expect(actionsSource).toContain('type: "related_url_collection_go_dashboard_clicked"');
    expect(actionsSource).toMatch(/redirect\(`\/dashboard\?themeId=\$\{themeId\}`\)/);
  });

  it("goGenerateFromUrlCollection은 이동 이벤트를 기록하고 대시보드의 #generate-draft로 이동한다", () => {
    expect(actionsSource).toContain("export async function goGenerateFromUrlCollection(formData: FormData): Promise<void>");
    expect(actionsSource).toContain('type: "related_url_collection_go_generate_clicked"');
    expect(actionsSource).toContain("#generate-draft");
  });

  it("모든 redirect 대상은 내부 경로(/themes 또는 /dashboard)만 사용한다(외부 URL redirect 없음)", () => {
    const redirectCalls = actionsSource.match(/redirect\(`[^`]*`\)/g) ?? [];
    expect(redirectCalls.length).toBeGreaterThan(0);
    for (const call of redirectCalls) {
      expect(call.includes("http://") || call.includes("https://")).toBe(false);
    }
  });
});

describe("기존 기능 보존 (Phase 3-27)", () => {
  it("importCandidatesToSources/dismissCandidate는 그대로 유지된다", () => {
    expect(actionsSource).toContain("export async function importCandidatesToSources(");
    expect(actionsSource).toContain("export async function dismissCandidate(");
  });
});
