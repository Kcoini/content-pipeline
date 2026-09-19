// Phase UX-03A: "자동 검토 요약" JSX가 app/articles/[id]/social/page.tsx와
// app/social-posts/[id]/page.tsx에 거의 동일한 구조로 중복 구현되어
// 있었다(톤 색상 계산, 통과/확인 필요/수정 필요/차단 개수 줄, 승인
// 가능 여부 안내, issue 목록). 이 컴포넌트는 그 공통 부분만 뽑아낸다.
//
// summarizeAutoReview(lib/social/social-post-auto-review.ts)가 반환하는
// AutoReviewSummary를 그대로 받아 렌더링한다 — 이 컴포넌트 자신은 DB를
// 읽거나 재계산하지 않는다(순수 표시 컴포넌트).
//
// 두 페이지의 문구 차이(글 유형/검토 기준 안내 문장, issue별 액션
// 링크, 자동 수정 가능 배너)는 그대로 유지해야 하므로 각각 슬롯/콜백
// props로 열어 둔다 — 고정 레이아웃으로 강제 통합하면 실제 화면에서
// 보여주던 정보(예: 이슈별 [수정하기] 링크)가 사라질 수 있다.

import type { ReactNode } from "react";
import {
  describeApprovalReadiness,
  describeAutoReviewRiskLevel,
  type AutoReviewIssue,
  type AutoReviewSummary,
  type UserFacingReviewSummary,
} from "@/lib/social/social-post-auto-review";
import { AdvancedDetails } from "@/components/common/advanced-details";

export interface AutoReviewSummaryCardProps {
  review: AutoReviewSummary;
  /** "글 유형: ... · 검토 기준: ..." 같은, 페이지마다 문구가 다른 컨텍스트 안내. 호출 측이 완성된 노드로 넘긴다. */
  contextNote: ReactNode;
  /** overallLabel 앞에 붙일 접두어(예: "자동 검토 결과: "). 이 카드 위에 별도 h2가 없는 목록 카드에서 쓴다. */
  labelPrefix?: string;
  /** issue 목록을 이 개수까지만 보여주고 "그 외 N건"으로 줄인다. 생략하면 전부 보여준다. */
  maxIssues?: number;
  /** issue 하나 옆에 붙일 액션(수정하기/본문 위치 보기 등). 페이지마다 라우팅이 달라 호출 측이 렌더링한다. */
  renderIssueActions?: (issue: AutoReviewIssue) => ReactNode;
  /** 카운트/승인 가능 안내 아래, issue 목록 위에 추가로 보여줄 배너(자동 수정 가능 안내 등). */
  extraBanner?: ReactNode;
  /** true면 이 컴포넌트가 issue 목록을 직접 렌더링하지 않는다 — 호출 측이 extraBanner 등으로 직접 보여줄 때 쓴다(예: HumanReviewPanel과 조합). */
  hideIssueList?: boolean;
  /** issue 목록 아래, 톤 색상 박스 안 맨 마지막에 보여줄 내용(재검토/자동 수정 action 버튼 등). */
  footer?: ReactNode;
  /** padding/글자 크기를 줄인 버전(목록 카드처럼 좁은 공간용). 기본은 상세 화면 크기. */
  compact?: boolean;
  /**
   * Phase UX-04A: 제공하면 기본 화면을 "헤드라인 + 확인할 사항 N건"으로
   * 단순화한다 — 통과/확인 필요/수정 필요/차단 개수 줄과 전체 issue
   * 목록(auto_fixable 포함)은 "자동 검토 상세" AdvancedDetails 안으로
   * 옮기고, 기본 화면의 issue 목록은 auto_fixable을 제외한
   * userFacingSummary.visibleIssues만 보여준다. 생략하면 기존 방식
   * (항상 4개 카운트 + 전체 issue 목록을 그대로 보여줌) 그대로 동작한다.
   */
  userFacingSummary?: UserFacingReviewSummary;
}

const TONE_CLASS: Record<AutoReviewSummary["overallStatus"], string> = {
  blocked: "border-red-200 bg-red-50 text-red-800",
  needs_fix: "border-orange-200 bg-orange-50 text-orange-800",
  needs_check: "border-amber-200 bg-amber-50 text-amber-800",
  passed: "border-green-200 bg-green-50 text-green-800",
};

export function AutoReviewSummaryCard({
  review,
  contextNote,
  labelPrefix,
  maxIssues,
  renderIssueActions,
  extraBanner,
  hideIssueList = false,
  footer,
  compact = false,
  userFacingSummary,
}: AutoReviewSummaryCardProps) {
  const issuePool = userFacingSummary ? userFacingSummary.visibleIssues : review.issues;
  const visibleIssues = !hideIssueList && maxIssues != null ? issuePool.slice(0, maxIssues) : issuePool;
  const hiddenCount = !hideIssueList && maxIssues != null ? issuePool.length - visibleIssues.length : 0;

  return (
    <div className={`mt-2 rounded border ${compact ? "p-2 text-[11px]" : "p-3 text-xs"} ${TONE_CLASS[review.overallStatus]}`}>
      {contextNote}
      <div className="mt-1 flex flex-wrap items-center justify-between gap-1">
        <p className="font-semibold">
          {labelPrefix}
          {review.overallLabel}
        </p>
        <span className="rounded-full bg-white/60 px-1.5 py-0.5 text-[11px] font-medium">
          위험도 {describeAutoReviewRiskLevel(review.riskLevel)}
        </span>
      </div>
      {userFacingSummary ? (
        <p className="mt-1">
          {userFacingSummary.confirmationCount > 0
            ? `확인할 사항 ${userFacingSummary.confirmationCount}건`
            : "확인할 사항 없음"}
        </p>
      ) : (
        <p className="mt-1">
          통과 {review.counts.passed}개 · 확인 필요 {review.counts.needsCheck}개 · 수정 필요 {review.counts.needsFix}개 · 차단{" "}
          {review.counts.blocked}개
        </p>
      )}
      <p className="mt-1">{describeApprovalReadiness(review)}</p>
      {extraBanner}
      {!hideIssueList && visibleIssues.length > 0 && (
        <ul className="mt-1.5 flex flex-col gap-0.5">
          {visibleIssues.map((issue) => (
            <li key={issue.key} className="flex flex-wrap items-center gap-2">
              <span>
                · [{issue.axisLabel}] {issue.message}
              </span>
              {renderIssueActions?.(issue)}
            </li>
          ))}
          {hiddenCount > 0 && <li>· 그 외 {hiddenCount}건 (상세 상태 보기 참고)</li>}
        </ul>
      )}
      {userFacingSummary && (
        <AdvancedDetails title="자동 검토 상세" className="mt-1.5">
          <p>
            통과 {review.counts.passed}개 · 확인 필요 {review.counts.needsCheck}개 · 수정 필요 {review.counts.needsFix}개 ·
            차단 {review.counts.blocked}개
          </p>
          {userFacingSummary.hiddenAutoFixableCount > 0 && (
            <p className="mt-1">
              시스템이 자동으로 정리했거나 정리를 시도한 항목 {userFacingSummary.hiddenAutoFixableCount}건은 여기 목록에
              포함되어 있습니다(사람이 직접 확인할 필요는 없습니다).
            </p>
          )}
          {review.issues.length > 0 && (
            <ul className="mt-1.5 flex flex-col gap-0.5">
              {review.issues.map((issue) => (
                <li key={issue.key}>
                  · [{issue.axisLabel}] {issue.message}
                </li>
              ))}
            </ul>
          )}
        </AdvancedDetails>
      )}
      {footer}
    </div>
  );
}
