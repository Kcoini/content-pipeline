// Phase UX-04B: 하나의 article에 생성된 여러 platform post를 사용자가
// 하나씩 열어보지 않고 한눈에 파악할 수 있는 요약 카드. 이 컴포넌트는
// 집계 로직을 갖지 않는다 — lib/ui/multi-platform-review-summary.ts의
// summarizeMultiPlatformReview() 결과(MultiPlatformReviewSummary)를
// 그대로 받아 렌더링만 한다. raw state 이름(ready/needs_confirmation/
// blocked/checking/failed/approval_status)은 절대 그대로 노출하지
// 않는다 — 항상 한국어 사용자 문구로 표시한다.

import type { ReactNode } from "react";
import type { MultiPlatformReviewSummary } from "@/lib/ui/multi-platform-review-summary";

export interface MultiPlatformReviewSummaryCardProps {
  summary: MultiPlatformReviewSummary;
  /** 카드 제목. 기본값 "플랫폼별 글 검토". */
  title?: ReactNode;
  /** 일괄 승인 버튼/폼을 넣을 슬롯 — 실제 action은 페이지마다 다르므로 호출 측이 렌더링한다. bulkApprovalEligiblePostIds.length가 0이면 호출하지 않는다(버튼을 만들지 못하게). */
  renderBulkApprovalAction?: (eligiblePostIds: readonly string[]) => ReactNode;
}

export function MultiPlatformReviewSummaryCard({
  summary,
  title = "플랫폼별 글 검토",
  renderBulkApprovalAction,
}: MultiPlatformReviewSummaryCardProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 text-xs">
      <h2 className="text-sm font-semibold text-zinc-700">{title}</h2>
      <dl className="mt-1.5 flex flex-col gap-0.5 text-zinc-600">
        <div>
          <dt className="inline font-medium">전체</dt> <dd className="inline">{summary.total}개</dd>
        </div>
        {summary.blocked > 0 && (
          <div className="font-medium text-red-700">
            <dt className="inline">게시 전 해결 필요</dt> <dd className="inline">{summary.blocked}개</dd>
          </div>
        )}
        {summary.needsConfirmation > 0 && (
          <div className="font-medium text-amber-700">
            <dt className="inline">확인 필요</dt> <dd className="inline">{summary.needsConfirmation}개</dd>
          </div>
        )}
        {summary.failed > 0 && (
          <div className="font-medium text-orange-700">
            <dt className="inline">자동 검토 실패</dt> <dd className="inline">{summary.failed}개</dd>
          </div>
        )}
        {summary.checking > 0 && (
          <div>
            <dt className="inline">자동 검토 중</dt> <dd className="inline">{summary.checking}개</dd>
          </div>
        )}
        {summary.ready > 0 && (
          <div className="text-green-700">
            <dt className="inline">확인할 사항 없음</dt> <dd className="inline">{summary.ready}개</dd>
          </div>
        )}
        {summary.approved > 0 && (
          <div>
            <dt className="inline">승인 완료</dt> <dd className="inline">{summary.approved}개</dd>
          </div>
        )}
      </dl>
      {summary.bulkApprovalEligiblePostIds.length > 0 && renderBulkApprovalAction?.(summary.bulkApprovalEligiblePostIds)}
    </div>
  );
}
