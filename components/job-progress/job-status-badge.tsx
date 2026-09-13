// Phase 4-17: Job Progress System — job_run/job_run_step의 status를 한국어
// 배지로 보여준다. raw status 문자열은 title 속성에만 남긴다("상세 상태
// 보기" 접힘 영역과는 별개로, hover 시에도 확인 가능하게).

import { getJobStatusLabel, getJobStatusTone } from "@/lib/job-progress/job-progress-labels";

const TONE_CLASSES: Record<string, string> = {
  neutral: "bg-zinc-100 text-zinc-600",
  progress: "bg-indigo-100 text-indigo-700",
  success: "bg-green-100 text-green-800",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-800",
};

export function JobStatusBadge({ status }: { status: string }) {
  const tone = getJobStatusTone(status);
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TONE_CLASSES[tone]}`} title={status}>
      {getJobStatusLabel(status)}
    </span>
  );
}
