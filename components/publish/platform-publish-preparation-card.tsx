// Phase UX-05A: 플랫폼 하나의 게시 준비 상태를 compact하게 보여주는
// 카드. 실제 버튼/링크는 페이지마다 라우팅이 다르므로 renderAction
// 콜백으로 호출 측이 구성한다(AutoReviewSummaryCard의 renderIssueActions,
// NextActionPanel의 renderAction과 같은 패턴).

import type { ReactNode } from "react";
import {
  getPublishCapability,
  describePublishCapability,
  type PublishPreparationAction,
  type PublishPreparationViewModel,
} from "@/lib/ui/publish-preparation-view-model";

const STATE_TONE_CLASS: Record<PublishPreparationViewModel["state"], string> = {
  failed: "border-red-200 bg-red-50 text-red-800",
  needs_attention: "border-amber-200 bg-amber-50 text-amber-800",
  needs_setup: "border-amber-200 bg-amber-50 text-amber-800",
  not_approved: "border-zinc-200 bg-zinc-50 text-zinc-700",
  ready: "border-green-200 bg-green-50 text-green-800",
  in_progress: "border-indigo-200 bg-indigo-50 text-indigo-800",
  completed: "border-zinc-200 bg-white text-zinc-600",
};

export interface PlatformPublishPreparationCardProps {
  viewModel: PublishPreparationViewModel;
  platformLabel: string;
  renderAction: (action: PublishPreparationAction, kind: "primary" | "secondary") => ReactNode;
}

export function PlatformPublishPreparationCard({ viewModel, platformLabel, renderAction }: PlatformPublishPreparationCardProps) {
  return (
    <div className={`rounded border p-2 text-[11px] ${STATE_TONE_CLASS[viewModel.state]}`}>
      <p className="font-semibold">{platformLabel}</p>
      <p className="mt-0.5">{viewModel.title}</p>
      {/* PRODUCT-01F 섹션 13: 플랫폼 이름/현재 상태/게시 방식/다음 행동
          4개를 기본으로 보여준다 — 게시 방식은 capability(draft/manual/
          copy)에서만 파생한다(새 값 추가 없음). */}
      <p className="mt-0.5 text-[10px] opacity-80">게시 방식: {describePublishCapability(getPublishCapability(viewModel.platform))}</p>
      {viewModel.message && <p className="mt-0.5 text-[10px] opacity-80">{viewModel.message}</p>}
      {viewModel.primaryAction && <div className="mt-1.5">{renderAction(viewModel.primaryAction, "primary")}</div>}
      {viewModel.primaryAction?.disabled && viewModel.primaryAction.disabledReason && (
        <p className="mt-1 text-[10px] text-zinc-500">{viewModel.primaryAction.disabledReason}</p>
      )}
      {viewModel.secondaryActions && viewModel.secondaryActions.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {viewModel.secondaryActions.map((action) => (
            <span key={action.type}>{renderAction(action, "secondary")}</span>
          ))}
        </div>
      )}
    </div>
  );
}
