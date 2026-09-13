"use client";

// Phase 4-14: SNS/커뮤니티 글 목록 카드에서 게시용 본문을 "짧으면 전체
// 표시, 길면 접기/펼치기"로 보여주기 위한 순수 표시용 컴포넌트. 페이지
// 이동이나 서버 action 호출 없이 같은 카드 안에서만 펼쳐진다 —
// useState로 펼침 여부만 토글하고, 그 외에는 어떤 상태도 서버에
// 반영하지 않는다.

import { useState } from "react";

const DEFAULT_THRESHOLD_LENGTH = 1200;
const DEFAULT_PREVIEW_LENGTH = 700;
const DEFAULT_EXPAND_LABEL = "전체 보기";
const DEFAULT_COLLAPSE_LABEL = "접기";

export interface ExpandableTextProps {
  text: string;
  /** 이 길이 이하이면 접지 않고 항상 전체를 보여준다(기본 1,200자). */
  collapsedLimit?: number;
  /** 접힌 상태에서 보여줄 길이(기본 700자, 600~800자 권장). */
  previewLength?: number;
  defaultExpanded?: boolean;
  expandLabel?: string;
  collapseLabel?: string;
  className?: string;
}

/**
 * SNS/커뮤니티 글 본문처럼 줄바꿈이 의미 있는 텍스트를 표시한다.
 * text.length가 collapsedLimit 이하면 버튼 없이 전체를 그대로 보여주고,
 * 넘으면 previewLength만큼만 보여준 뒤 "전체 보기" 버튼으로 나머지를
 * 펼칠 수 있게 한다. 상세 페이지 이동이나 서버 action 호출은 하지
 * 않는다 — 클릭은 이 컴포넌트 안에서만 상태를 바꾼다.
 */
export function ExpandableText({
  text,
  collapsedLimit = DEFAULT_THRESHOLD_LENGTH,
  previewLength = DEFAULT_PREVIEW_LENGTH,
  defaultExpanded = false,
  expandLabel = DEFAULT_EXPAND_LABEL,
  collapseLabel = DEFAULT_COLLAPSE_LABEL,
  className,
}: ExpandableTextProps) {
  const needsCollapse = text.length > collapsedLimit;
  const [expanded, setExpanded] = useState(defaultExpanded || !needsCollapse);

  if (!needsCollapse) {
    return <p className={className} style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.7 }}>{text}</p>;
  }

  const displayText = expanded ? text : `${text.slice(0, previewLength).trimEnd()}…`;

  return (
    <div>
      <p className={className} style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.7 }}>
        {displayText}
      </p>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="mt-1 rounded border border-indigo-300 bg-white px-2 py-0.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-50"
      >
        {expanded ? collapseLabel : expandLabel}
      </button>
    </div>
  );
}
