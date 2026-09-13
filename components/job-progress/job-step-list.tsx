// Phase 4-17: Job Progress System — job_run에 속한 단계 목록을 순서대로
// 보여준다. 기본은 접힘("상세 단계 보기") 상태로 두고, 실패한 단계가
// 있으면 그 단계의 message/error_message만 눈에 띄게 보여준다.

import { JobStatusBadge } from "./job-status-badge";

export interface JobStepListItem {
  stepKey: string;
  stepLabel: string;
  status: string;
  message: string | null;
  errorMessage: string | null;
}

export function JobStepList({ steps }: { steps: JobStepListItem[] }) {
  if (steps.length === 0) {
    return <p className="text-xs text-zinc-400">등록된 단계가 없습니다.</p>;
  }

  return (
    <ol className="flex flex-col gap-1.5">
      {steps.map((step, index) => (
        <li key={step.stepKey} className="flex flex-col gap-0.5 rounded border border-zinc-100 px-2 py-1.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-zinc-700">
              {index + 1}. {step.stepLabel}
            </span>
            <JobStatusBadge status={step.status} />
          </div>
          {step.message && <p className="text-zinc-500">{step.message}</p>}
          {step.errorMessage && (
            <details className="mt-0.5">
              <summary className="cursor-pointer text-[11px] text-red-500">상세 오류 보기</summary>
              <p className="mt-0.5 rounded bg-red-50 p-1 text-[11px] text-red-700">{step.errorMessage}</p>
            </details>
          )}
        </li>
      ))}
    </ol>
  );
}
