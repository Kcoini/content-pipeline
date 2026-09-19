import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextActionPanel } from "./next-action-panel";
import type { NextActionViewModel } from "@/lib/ui/next-action-view-model";

const renderAction = (action: { label: string; actionType: string }, kind: "primary" | "secondary") => (
  <button data-kind={kind} data-action-type={action.actionType}>
    {action.label}
  </button>
);

describe("NextActionPanel", () => {
  it("primary action은 최대 1개만 렌더링한다", () => {
    const vm: NextActionViewModel = {
      state: "ready",
      primaryAction: { label: "승인", actionType: "approve" },
      secondaryActions: [{ label: "상세 보기", actionType: "view_detail" }],
    };
    const html = renderToStaticMarkup(<NextActionPanel viewModel={vm} renderAction={renderAction} />);
    expect(html.match(/data-kind="primary"/g)?.length).toBe(1);
    expect(html).toContain("승인");
    expect(html).toContain("상세 보기");
  });

  it("secondary action 여러 개를 지원한다", () => {
    const vm: NextActionViewModel = {
      state: "ready",
      primaryAction: { label: "A", actionType: "a" },
      secondaryActions: [
        { label: "B", actionType: "b" },
        { label: "C", actionType: "c" },
      ],
    };
    const html = renderToStaticMarkup(<NextActionPanel viewModel={vm} renderAction={renderAction} />);
    expect(html.match(/data-kind="secondary"/g)?.length).toBe(2);
  });

  it("disabledReason을 자연어로 표시한다", () => {
    const vm: NextActionViewModel = {
      state: "needs_attention",
      primaryAction: { label: "승인", actionType: "approve", disabled: true, disabledReason: "품질검사를 먼저 완료해 주세요." },
    };
    const html = renderToStaticMarkup(<NextActionPanel viewModel={vm} renderAction={renderAction} />);
    expect(html).toContain("품질검사를 먼저 완료해 주세요.");
  });

  it("blocked 상태를 다른 톤 색상으로 표시한다", () => {
    const vm: NextActionViewModel = { state: "blocked", message: "차단됨" };
    const html = renderToStaticMarkup(<NextActionPanel viewModel={vm} renderAction={renderAction} />);
    expect(html).toContain("border-red-200");
    expect(html).toContain("차단됨");
  });

  it("completed 상태를 표시하고, primary action이 있으면 함께 보여준다", () => {
    const vm: NextActionViewModel = {
      state: "completed",
      message: "게시 준비 완료",
      primaryAction: { label: "게시글 보기", actionType: "view_published" },
    };
    const html = renderToStaticMarkup(<NextActionPanel viewModel={vm} renderAction={renderAction} />);
    expect(html).toContain("border-green-200");
    expect(html).toContain("게시글 보기");
  });

  it("action이 전혀 없으면 fallbackActions를 보여준다(dead-end 방지)", () => {
    const vm: NextActionViewModel = { state: "ready", message: "다음 작업을 계산하지 못함" };
    const html = renderToStaticMarkup(
      <NextActionPanel
        viewModel={vm}
        renderAction={renderAction}
        fallbackActions={[{ label: "본문 확인", actionType: "view_detail" }]}
      />
    );
    expect(html).toContain("다음 작업을 자동으로 결정하지 못했습니다.");
    expect(html).toContain("본문 확인");
  });

  it("action도 fallback도 없으면 '추가로 필요한 작업이 없습니다'를 보여준다(무반응 방지)", () => {
    const vm: NextActionViewModel = { state: "completed", message: "완료" };
    const html = renderToStaticMarkup(<NextActionPanel viewModel={vm} renderAction={renderAction} />);
    expect(html).toContain("추가로 필요한 작업이 없습니다.");
  });

  it("raw state 값(needs_attention 등)을 화면 텍스트로 노출하지 않는다", () => {
    const vm: NextActionViewModel = { state: "needs_attention", message: "확인이 필요합니다." };
    const html = renderToStaticMarkup(<NextActionPanel viewModel={vm} renderAction={renderAction} />);
    expect(html).not.toContain("needs_attention");
  });

  it("state===in_progress이고 progressContent가 있으면 버튼 대신 그 내용을 보여준다", () => {
    const vm: NextActionViewModel = {
      state: "in_progress",
      message: "글 생성 중",
      primaryAction: { label: "재실행", actionType: "retry" },
    };
    const html = renderToStaticMarkup(
      <NextActionPanel viewModel={vm} renderAction={renderAction} progressContent={<p>진행률 42%</p>} />
    );
    expect(html).toContain("진행률 42%");
    expect(html).not.toContain("재실행");
  });
});
