// Phase UX-05A: "게시 준비" 전체 요약 카드. UX-04B의
// MultiPlatformReviewSummaryCard와 같은 패턴이다 — 집계 로직 없이
// MultiPlatformPublishPreparationSummary만 받아 렌더링한다. raw
// state(not_approved/needs_attention/... 등)와 raw status(publish_status/
// approval_status/export_status 등)는 기본 화면에 노출하지 않는다.

import type { ReactNode } from "react";
import type { MultiPlatformPublishPreparationSummary } from "@/lib/ui/multi-platform-publish-preparation-summary";

export interface PublishPreparationSummaryCardProps {
  summary: MultiPlatformPublishPreparationSummary;
  title?: ReactNode;
}

export function PublishPreparationSummaryCard({ summary, title = "게시 준비" }: PublishPreparationSummaryCardProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 text-xs">
      <h2 className="text-sm font-semibold text-zinc-700">{title}</h2>
      <dl className="mt-1.5 flex flex-col gap-0.5 text-zinc-600">
        <div>
          <dt className="inline font-medium">전체</dt> <dd className="inline">{summary.total}개</dd>
        </div>
        {summary.failed > 0 && (
          <div className="font-medium text-red-700">
            <dt className="inline">처리 실패</dt> <dd className="inline">{summary.failed}개</dd>
          </div>
        )}
        {summary.needsAttention > 0 && (
          <div className="font-medium text-amber-700">
            <dt className="inline">확인 필요</dt> <dd className="inline">{summary.needsAttention}개</dd>
          </div>
        )}
        {summary.needsSetup > 0 && (
          <div className="font-medium text-amber-700">
            <dt className="inline">게시 설정 필요</dt> <dd className="inline">{summary.needsSetup}개</dd>
          </div>
        )}
        {summary.notApproved > 0 && (
          <div>
            <dt className="inline">승인 필요</dt> <dd className="inline">{summary.notApproved}개</dd>
          </div>
        )}
        {summary.ready > 0 && (
          <div className="text-green-700">
            <dt className="inline">게시 준비 완료</dt> <dd className="inline">{summary.ready}개</dd>
          </div>
        )}
        {summary.inProgress > 0 && (
          <div>
            <dt className="inline">처리 중</dt> <dd className="inline">{summary.inProgress}개</dd>
          </div>
        )}
        {summary.completed > 0 && (
          <div>
            <dt className="inline">완료</dt> <dd className="inline">{summary.completed}개</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
