// Phase UX-03B1: "현재 상태"를 화면마다 통일해서 보여주는 공통
// 컴포넌트. WorkflowStatusViewModel(lib/ui/workflow-status-view-model.ts)을
// 받아 제목 + 완료된 항목 + 남은 작업만 보여준다 — 내부 파이프라인
// 단계 전체를 나열하지 않는다(필요하면 AdvancedDetails 접힘에서
// 별도로 보여준다).

import type { WorkflowState, WorkflowStatusViewModel } from "@/lib/ui/workflow-status-view-model";

export interface WorkflowStatusCardProps {
  viewModel: WorkflowStatusViewModel;
  heading?: string;
}

const STATE_CLASS: Record<WorkflowState, string> = {
  idle: "border-zinc-200 bg-zinc-50 text-zinc-600",
  in_progress: "border-blue-200 bg-blue-50 text-blue-800",
  needs_attention: "border-amber-200 bg-amber-50 text-amber-800",
  ready: "border-indigo-200 bg-indigo-50 text-indigo-900",
  completed: "border-green-200 bg-green-50 text-green-800",
  blocked: "border-red-200 bg-red-50 text-red-800",
};

export function WorkflowStatusCard({ viewModel, heading = "현재 상태" }: WorkflowStatusCardProps) {
  const { state, title, message, completedItems = [], remainingItems = [] } = viewModel;

  return (
    <div className={`rounded border p-3 text-xs ${STATE_CLASS[state]}`}>
      <p className="text-[11px] font-semibold">{heading}</p>
      <p className="mt-1 font-medium">{title}</p>
      {message && <p className="mt-1">{message}</p>}
      {completedItems.length > 0 && <p className="mt-1.5 text-emerald-700">완료: {completedItems.join(" · ")}</p>}
      {remainingItems.length > 0 && <p className="mt-1 text-amber-700">남은 작업: {remainingItems.join(" · ")}</p>}
    </div>
  );
}
