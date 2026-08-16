// Phase 3-21: Platform API Publishing Preparation.
// readiness status를 배지 형태로 보여주는 공용 컴포넌트. 환경변수
// 값은 절대 표시하지 않는다 — status/이름만 표시한다.

import type { PlatformApiReadinessStatus } from "@/lib/social/platform-api-readiness-checker";

const STATUS_LABELS: Record<PlatformApiReadinessStatus, string> = {
  not_supported: "미지원",
  disabled: "비활성화됨",
  missing_config: "설정 누락",
  dry_run_ready: "Dry-run 준비됨",
  ready_for_future_test: "향후 테스트 준비됨",
  blocked: "차단됨",
};

const STATUS_STYLES: Record<PlatformApiReadinessStatus, string> = {
  not_supported: "bg-zinc-100 text-zinc-500",
  disabled: "bg-zinc-100 text-zinc-600",
  missing_config: "bg-amber-100 text-amber-700",
  dry_run_ready: "bg-blue-100 text-blue-700",
  ready_for_future_test: "bg-indigo-100 text-indigo-700",
  blocked: "bg-red-100 text-red-700",
};

export function ApiReadinessBadge({ status }: { status: PlatformApiReadinessStatus }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[status]}`}>{STATUS_LABELS[status]}</span>;
}

export { STATUS_LABELS as API_READINESS_STATUS_LABELS };
