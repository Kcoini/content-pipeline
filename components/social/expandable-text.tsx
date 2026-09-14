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
  /**
   * Phase 4-27: 있으면 펼침 상태를 이 값으로 제어한다(내부 useState를
   * 쓰지 않는다) — PostBodyActionRow처럼 [본문 복사]/[전체 보기]/[본문
   * 수정]을 한 줄에 모아 보여주는 공통 버튼 행이 토글 버튼을 대신
   * 소유할 때 쓴다. 생략하면(기존과 동일) 내부 상태로 펼침을 관리한다.
   */
  expanded?: boolean;
  /**
   * true면 이 컴포넌트 자신의 "전체 보기"/"접기" 버튼을 렌더링하지
   * 않는다 — 같은 토글을 PostBodyActionRow가 대신 보여줄 때, 버튼이
   * 본문 위/아래에 중복 표시되지 않도록 한다. `expanded`와 함께 쓴다.
   */
  hideToggleButton?: boolean;
}

/** 본문 길이만으로 접기가 필요한지 판단하는 순수 함수(threshold는 ExpandableText와 항상 같은 기준을 쓴다). */
export function needsExpandableCollapse(text: string, collapsedLimit: number = DEFAULT_THRESHOLD_LENGTH): boolean {
  return text.length > collapsedLimit;
}

/**
 * SNS/커뮤니티 글 본문처럼 줄바꿈이 의미 있는 텍스트를 표시한다.
 * text.length가 collapsedLimit 이하면 버튼 없이 전체를 그대로 보여주고,
 * 넘으면 previewLength만큼만 보여준 뒤 "전체 보기" 버튼으로 나머지를
 * 펼칠 수 있게 한다. 상세 페이지 이동이나 서버 action 호출은 하지
 * 않는다 — 클릭은 이 컴포넌트 안에서만 상태를 바꾼다(단, `expanded`를
 * 넘기면 그 값을 그대로 따르는 controlled 컴포넌트가 된다).
 */
export function ExpandableText({
  text,
  collapsedLimit = DEFAULT_THRESHOLD_LENGTH,
  previewLength = DEFAULT_PREVIEW_LENGTH,
  defaultExpanded = false,
  expandLabel = DEFAULT_EXPAND_LABEL,
  collapseLabel = DEFAULT_COLLAPSE_LABEL,
  className,
  expanded: controlledExpanded,
  hideToggleButton = false,
}: ExpandableTextProps) {
  const needsCollapse = needsExpandableCollapse(text, collapsedLimit);
  const [uncontrolledExpanded, setUncontrolledExpanded] = useState(defaultExpanded || !needsCollapse);
  const expanded = controlledExpanded ?? uncontrolledExpanded;

  if (!needsCollapse) {
    return <p className={className} style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.7 }}>{text}</p>;
  }

  const displayText = expanded ? text : `${text.slice(0, previewLength).trimEnd()}…`;

  return (
    <div>
      <p className={className} style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.7 }}>
        {displayText}
      </p>
      {!hideToggleButton && (
        <button
          type="button"
          onClick={() => setUncontrolledExpanded((prev) => !prev)}
          className="mt-1 rounded border border-indigo-300 bg-white px-2 py-0.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-50"
        >
          {expanded ? collapseLabel : expandLabel}
        </button>
      )}
    </div>
  );
}
