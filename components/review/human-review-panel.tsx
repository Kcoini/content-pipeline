// Phase UX-03A: "AI가 자동으로 처리할 수 있는 문제"와 "사람이 실제로
// 판단해야 하는 문제"를 같은 목록에 섞어서 보여주지 않기 위한 공통
// 컴포넌트. 이 컴포넌트는 어떤 항목이 auto_fixable인지 스스로
// 판단하지 않는다 — 호출 측이 이미 lib/social/review-issue-fixability.ts의
// classifyReviewIssue/summarizeReviewIssues로 분류한 결과 중
// user_confirmation_required/blocking 항목만 HumanReviewItem으로
// 변환해서 넘긴다(auto_fixable 항목은 이 패널에 넣지 않는다 — 이미
// 별도의 "자동으로 정리할 수 있는 항목" 안내로 다뤄진다).

import type { ReactNode } from "react";

export interface HumanReviewItem {
  id: string;
  /** 무엇을 확인해야 하는지(예: "출처 확인 필요", "수치 확인 필요"). */
  label: string;
  /** 추가 설명(있으면). */
  description?: string;
  /** info: 참고용, warning: 확인 권장, blocking: 승인을 막는 문제. */
  severity?: "info" | "warning" | "blocking";
  actionLabel?: string;
  actionHref?: string;
}

export interface HumanReviewPanelProps {
  items: HumanReviewItem[];
  /** 항목이 하나도 없을 때 보여줄 문구. */
  emptyMessage?: string;
  /** 항목이 있을 때 목록 위에 보여줄 제목(생략하면 제목 없이 목록만). */
  title?: ReactNode;
}

const SEVERITY_BADGE_CLASS: Record<NonNullable<HumanReviewItem["severity"]>, string> = {
  info: "bg-zinc-100 text-zinc-600",
  warning: "bg-amber-100 text-amber-800",
  blocking: "bg-red-100 text-red-800",
};

const SEVERITY_BADGE_LABEL: Record<NonNullable<HumanReviewItem["severity"]>, string> = {
  info: "참고",
  warning: "확인 필요",
  blocking: "승인 불가",
};

/**
 * 사용자가 실제로 확인해야 하는 항목만 보여준다. 항목이 없으면
 * "확인할 사항 없음"만 compact하게 보여주고, raw fixability enum
 * (auto_fixable/user_confirmation_required/blocking)은 절대 그대로
 * 노출하지 않는다 — severity 배지는 항상 한국어 라벨로 표시한다.
 */
export function HumanReviewPanel({ items, emptyMessage = "확인할 사항 없음", title }: HumanReviewPanelProps) {
  if (items.length === 0) {
    return <p className="mt-1.5 text-[11px] text-zinc-500">{emptyMessage}</p>;
  }

  return (
    <div className="mt-1.5">
      {title}
      <ul className="mt-1 flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-start gap-2">
            {item.severity && (
              <span className={`mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${SEVERITY_BADGE_CLASS[item.severity]}`}>
                {SEVERITY_BADGE_LABEL[item.severity]}
              </span>
            )}
            <span>
              <span className="font-medium">{item.label}</span>
              {item.description && <span className="text-zinc-600"> — {item.description}</span>}
            </span>
            {item.actionHref && item.actionLabel && (
              <a
                href={item.actionHref}
                className="rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100"
              >
                {item.actionLabel}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
