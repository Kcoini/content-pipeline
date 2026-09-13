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

export function CopyPostBodyButton({ articleId, socialPostId, text, className, label = "본문 복사" }: CopyPostBodyButtonProps) {
  const [feedback, setFeedback] = useState<string | null>(null);

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
    </span>
  );
}
