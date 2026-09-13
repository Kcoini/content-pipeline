// Phase 4-17: Job Progress System — 하나의 job_run 상태를 사용자에게
// 보여주는 공통 카드. 서버 컴포넌트(최초 렌더)와 클라이언트 컴포넌트
// (JobProgressPolling, polling 결과 갱신) 양쪽에서 그대로 재사용한다.
//
// raw job_type/status/error는 기본 화면에 직접 보여주지 않는다 —
// JobStatusBadge/getJobTypeLabel로 변환한 문구를 먼저 보여주고, raw
// 값과 각 단계 detail은 "상세 단계 보기"/"상세 오류 보기" 접힘
// 영역에서만 노출한다.

import { getJobErrorCategoryLabel, getJobTypeLabel, isTerminalJobStatus } from "@/lib/job-progress/job-progress-labels";
import { formatRelativeTimeFromNow } from "@/lib/job-progress/relative-time";
import { JobStatusBadge } from "./job-status-badge";
import { JobStepList, type JobStepListItem } from "./job-step-list";
import type { JobStatus } from "@/lib/job-progress/job-progress-types";

export interface JobProgressCardData {
  id: string;
  jobType: string;
  status: JobStatus;
  currentStepLabel: string | null;
  totalSteps: number;
  completedSteps: number;
  progressPercent: number;
  userMessage: string | null;
  errorMessage: string | null;
  errorCategory: string | null;
  retryable: boolean;
  nextActionLabel: string | null;
  nextActionHref: string | null;
  lastHeartbeatAt: string | null;
  steps: JobStepListItem[];
}

export interface JobProgressCardProps {
  jobRun: JobProgressCardData;
  /** 멈춤 가능성 표시 여부 — detectStalledJobRun()의 결과를 그대로 전달한다. */
  isStalled?: boolean;
  /** [상태 새로고침] 버튼 클릭 핸들러(JobProgressPolling이 넘겨준다). 없으면 버튼을 숨긴다. */
  onRefresh?: () => void;
  /** [다시 시도] 버튼으로 이동할 링크(실패 시 재시도 action의 URL 등). */
  retryHref?: string;
}

export function JobProgressCard({ jobRun, isStalled = false, onRefresh, retryHref }: JobProgressCardProps) {
  const displayStatus = isStalled ? "stalled" : jobRun.status;
  const isFailed = jobRun.status === "failed";
  const isBlocked = jobRun.status === "blocked";
  const isCompleted = jobRun.status === "completed";
  const isPartialSuccess = jobRun.status === "partial_success";
  const isRunning = !isTerminalJobStatus(jobRun.status);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-3 text-xs shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-800">{getJobTypeLabel(jobRun.jobType)}</h3>
        <JobStatusBadge status={displayStatus} />
      </div>

      {jobRun.totalSteps > 0 && (
        <div className="mt-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
            <div
              className={`h-full rounded-full transition-all ${isFailed || isBlocked ? "bg-red-400" : isCompleted ? "bg-green-500" : "bg-indigo-500"}`}
              style={{ width: `${jobRun.progressPercent}%` }}
            />
          </div>
          <p className="mt-1 text-zinc-500">
            {jobRun.completedSteps}/{jobRun.totalSteps}단계 완료
          </p>
        </div>
      )}

      {isRunning && jobRun.currentStepLabel && (
        <p className="mt-2 text-zinc-600">
          현재 단계: <span className="font-medium">{jobRun.currentStepLabel}</span>
        </p>
      )}

      {isStalled && (
        <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800">
          작업이 예상보다 오래 걸리고 있습니다. 실패로 확정된 것은 아니니 잠시 후 다시 확인해 주세요.
        </p>
      )}

      {jobRun.lastHeartbeatAt && <p className="mt-1 text-zinc-400">마지막 진행: {formatRelativeTimeFromNow(jobRun.lastHeartbeatAt)}</p>}

      {jobRun.userMessage && (isCompleted || isPartialSuccess || isBlocked) && (
        <p className="mt-2 rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-zinc-700">{jobRun.userMessage}</p>
      )}

      {isFailed && (
        <div className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-red-800">
          <p className="font-medium">작업이 중단되었습니다</p>
          <p className="mt-0.5">{getJobErrorCategoryLabel(jobRun.errorCategory)}</p>
          {jobRun.errorMessage && (
            <details className="mt-1">
              <summary className="cursor-pointer text-[11px] text-red-500">상세 오류 보기</summary>
              <p className="mt-0.5 text-[11px]">{jobRun.errorMessage}</p>
            </details>
          )}
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        {onRefresh && isRunning && (
          <button type="button" onClick={onRefresh} className="rounded border border-zinc-300 bg-white px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-50">
            상태 새로고침
          </button>
        )}
        {(isFailed || isStalled) && jobRun.retryable && retryHref && (
          <a href={retryHref} className="rounded bg-indigo-600 px-2 py-1 font-medium text-white hover:bg-indigo-500">
            다시 시도
          </a>
        )}
        {jobRun.nextActionLabel && jobRun.nextActionHref && (
          <a href={jobRun.nextActionHref} className="rounded bg-indigo-600 px-2 py-1 font-medium text-white hover:bg-indigo-500">
            {jobRun.nextActionLabel}
          </a>
        )}
      </div>

      {jobRun.steps.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[11px] text-zinc-400">상세 단계 보기</summary>
          <div className="mt-1">
            <JobStepList steps={jobRun.steps} />
          </div>
        </details>
      )}
    </section>
  );
}
