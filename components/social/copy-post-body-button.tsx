"use client";

// Phase 4-15: SNS/커뮤니티 글 목록 카드에서 게시용 본문 전체를 클립보드로
// 복사하는 버튼. 화면에 접혀 보이는 축약문이 아니라 항상 전달받은 text
// 전체(getSocialPostDisplayBody(post) 결과)를 복사한다 — 표시 상태와
// 무관하다.

import { useState } from "react";
import { logSocialPostInlineEditClientEventAction } from "@/app/articles/[id]/actions";

const SUCCESS_MESSAGE = "본문을 복사했습니다.";
const FAILURE_MESSAGE = "복사하지 못했습니다. 본문을 직접 선택해 복사해 주세요.";
const RESET_DELAY_MS = 3000;

export interface CopyPostBodyButtonProps {
  articleId: string;
  socialPostId: string;
  text: string;
  className?: string;
  label?: string;
  /**
   * Phase UX-05B: 제공하면 복사 성공 메시지 아래에 "게시 완료로 표시"
   * 안내 링크를 함께 보여준다(해당 anchor로 이동만 한다 — DB에 복사
   * 여부를 저장하지 않는다. 순수 client 상태다). 이 페이지에 실제로
   * "게시 결과 기록" 섹션이 있을 때만(호출 측이 판단) 넘긴다 — 생략하면
   * 기존과 동일하게 복사 성공 메시지만 보여준다.
   */
  manualResultAnchorId?: string;
}

/** navigator.clipboard가 없거나 실패하는 환경을 위한 fallback(임시 textarea + execCommand). */
function copyWithFallback(text: string): boolean {
  if (typeof document === "undefined") return false;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  let succeeded = false;
  try {
    succeeded = document.execCommand("copy");
  } catch {
    succeeded = false;
  }
  document.body.removeChild(textarea);
  return succeeded;
}

export function CopyPostBodyButton({
  articleId,
  socialPostId,
  text,
  className,
  label = "본문 복사",
  manualResultAnchorId,
}: CopyPostBodyButtonProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  // Phase UX-05B: 복사 성공 자체는 "게시 완료"가 아니다(governance:
  // 본문 복사는 실제 게시 완료가 아니다) — DB에 아무것도 쓰지 않는
  // 순수 client 상태로만, 복사 직후 한 번 안내 링크를 보여준다.
  const [showManualResultHint, setShowManualResultHint] = useState(false);

  const handleClick = async () => {
    let succeeded = false;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(text);
        succeeded = true;
      } else {
        succeeded = copyWithFallback(text);
      }
    } catch {
      succeeded = copyWithFallback(text);
    }

    setFeedback(succeeded ? SUCCESS_MESSAGE : FAILURE_MESSAGE);
    setShowManualResultHint(succeeded && Boolean(manualResultAnchorId));
    window.setTimeout(() => setFeedback(null), RESET_DELAY_MS);

    // 로그 실패가 복사 자체의 성공/실패 표시를 막지 않도록 별도로 처리한다.
    void logSocialPostInlineEditClientEventAction({
      articleId,
      socialPostId,
      event: succeeded ? "copied" : "copy_failed",
    }).catch(() => {});
  };

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        className={className ?? "rounded border border-indigo-300 bg-white px-2 py-0.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-50"}
      >
        {label}
      </button>
      {feedback && <span className="text-[10px] text-zinc-500">{feedback}</span>}
      {showManualResultHint && manualResultAnchorId && (
        <span className="text-[10px] text-zinc-500">
          외부 플랫폼에서 게시한 뒤{" "}
          <a href={`#${manualResultAnchorId}`} className="font-medium text-indigo-700 underline">
            게시 완료로 표시
          </a>
          할 수 있습니다.
        </span>
      )}
    </span>
  );
}
