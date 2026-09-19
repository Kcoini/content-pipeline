// Phase UX-03B1: "다음 작업" 표시를 화면마다 통일하기 위한 공통
// 컴포넌트. NextActionViewModel(lib/ui/next-action-view-model.ts)을
// 받아 "다음 작업" 제목 + 상태 메시지 + primary action 1개 + secondary
// action 목록을 렌더링한다.
//
// 실제 버튼/링크/form은 renderAction 콜백으로 호출 측이 구성한다 —
// 페이지마다 server action/href가 다르므로, 이 컴포넌트가 라우팅을
// 대신 결정하지 않는다(UI 契約만 통합, business logic은 그대로 각
// helper/페이지에 남는다).

import type { ReactNode } from "react";
import type { NextActionState, NextActionViewModel, NextActionViewModelAction } from "@/lib/ui/next-action-view-model";

export interface NextActionPanelProps {
  viewModel: NextActionViewModel;
  /** primary/secondary action 하나를 실제 버튼/링크/form으로 렌더링한다. */
  renderAction: (action: NextActionViewModelAction, kind: "primary" | "secondary") => ReactNode;
  title?: string;
  /** state === "in_progress"일 때 버튼 대신 보여줄 내용(예: JobProgressCard). 없으면 평소처럼 버튼을 보여준다. */
  progressContent?: ReactNode;
  /** primary/secondary action이 모두 없을 때 보여줄 안전한 fallback action 목록. */
  fallbackActions?: NextActionViewModelAction[];
}

const STATE_CLASS: Record<NextActionState, string> = {
  none: "border-zinc-200 bg-zinc-50 text-zinc-600",
  in_progress: "border-blue-200 bg-blue-50 text-blue-800",
  needs_attention: "border-amber-200 bg-amber-50 text-amber-800",
  ready: "border-indigo-200 bg-indigo-50 text-indigo-900",
  completed: "border-green-200 bg-green-50 text-green-800",
  blocked: "border-red-200 bg-red-50 text-red-800",
};

export function NextActionPanel({
  viewModel,
  renderAction,
  title = "다음 작업",
  progressContent,
  fallbackActions,
}: NextActionPanelProps) {
  const { state, message, primaryAction, secondaryActions = [] } = viewModel;
  const toneClass = STATE_CLASS[state];

  if (state === "in_progress" && progressContent) {
    return (
      <div className={`mt-2 rounded border p-3 text-xs ${toneClass}`}>
        <p className="text-[11px] font-semibold">{title}</p>
        {message && <p className="mt-1">{message}</p>}
        <div className="mt-2">{progressContent}</div>
      </div>
    );
  }

  const hasAnyAction = Boolean(primaryAction) || secondaryActions.length > 0;
  const fallback = !hasAnyAction && fallbackActions && fallbackActions.length > 0 ? fallbackActions : null;

  return (
    <div className={`mt-2 rounded border p-3 text-xs ${toneClass}`}>
      <p className="text-[11px] font-semibold">{title}</p>
      {message && <p className="mt-1">{message}</p>}

      {primaryAction && (
        <div className="mt-2">
          {renderAction(primaryAction, "primary")}
          {primaryAction.disabled && primaryAction.disabledReason && (
            <p className="mt-1 text-[11px] text-red-700">{primaryAction.disabledReason}</p>
          )}
        </div>
      )}

      {secondaryActions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {secondaryActions.map((action, i) => (
            <span key={`${action.actionType}-${i}`}>{renderAction(action, "secondary")}</span>
          ))}
        </div>
      )}

      {/* 사용자가 작업 가능한 상태인데 primary/secondary가 전부 비어
          있는 dead-end를 만들지 않는다 — 실제로 가능한 fallback
          action만(예: 본문 확인) 안내한다. */}
      {fallback && (
        <div className="mt-2 flex flex-col gap-2">
          <p>다음 작업을 자동으로 결정하지 못했습니다.</p>
          <div className="flex flex-wrap gap-2">
            {fallback.map((action, i) => (
              <span key={`${action.actionType}-${i}`}>{renderAction(action, "secondary")}</span>
            ))}
          </div>
        </div>
      )}

      {!hasAnyAction && !fallback && <p className="mt-1 text-[11px] text-zinc-500">추가로 필요한 작업이 없습니다.</p>}
    </div>
  );
}
