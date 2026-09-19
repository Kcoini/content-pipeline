import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkflowStatusCard } from "./workflow-status-card";
import type { WorkflowState, WorkflowStatusViewModel } from "@/lib/ui/workflow-status-view-model";

function makeVm(state: WorkflowState, overrides: Partial<WorkflowStatusViewModel> = {}): WorkflowStatusViewModel {
  return { state, title: `상태: ${state}`, ...overrides };
}

describe("WorkflowStatusCard", () => {
  const states: WorkflowState[] = ["idle", "in_progress", "needs_attention", "ready", "completed", "blocked"];

  it.each(states)("state=%s를 오류 없이 렌더링하고 title을 보여준다", (state) => {
    const vm = makeVm(state);
    const html = renderToStaticMarkup(<WorkflowStatusCard viewModel={vm} />);
    expect(html).toContain(vm.title);
  });

  it("완료된 항목/남은 작업을 · 로 구분해 보여준다", () => {
    const vm = makeVm("needs_attention", { completedItems: ["품질검사 완료", "승인 완료"], remainingItems: ["대표 이미지"] });
    const html = renderToStaticMarkup(<WorkflowStatusCard viewModel={vm} />);
    expect(html).toContain("완료: 품질검사 완료 · 승인 완료");
    expect(html).toContain("남은 작업: 대표 이미지");
  });

  it("completedItems/remainingItems가 없으면 해당 줄을 렌더링하지 않는다", () => {
    const vm = makeVm("idle");
    const html = renderToStaticMarkup(<WorkflowStatusCard viewModel={vm} />);
    expect(html).not.toContain("완료:");
    expect(html).not.toContain("남은 작업:");
  });

  it("heading을 커스터마이즈할 수 있다", () => {
    const vm = makeVm("ready");
    const html = renderToStaticMarkup(<WorkflowStatusCard viewModel={vm} heading="글 상태" />);
    expect(html).toContain("글 상태");
  });

  it("raw state 값을 화면 텍스트로 노출하지 않는다(title/message로만 표시)", () => {
    const vm: WorkflowStatusViewModel = { state: "needs_attention", title: "확인 필요" };
    const html = renderToStaticMarkup(<WorkflowStatusCard viewModel={vm} />);
    expect(html).not.toContain("needs_attention");
    expect(html).toContain("확인 필요");
  });
});
