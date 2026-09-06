"use client";

// action 실행 후 결과 메시지(성공/실패)를 본문 중간에 계속 남는 alert box로
// 보여주지 않고, 화면 오른쪽 위에 잠깐 떴다 자동으로 사라지는 toast로
// 보여주기 위한 컴포넌트. 상세 기록은 페이지 하단 "프로세스 로그 / 실행
// 이력"에서 확인한다 — 이 컴포넌트는 "지금 막 뭘 했는지"만 짧게 알려준다.
//
// 새 라이브러리를 추가하지 않고 기존 Tailwind + React state/useEffect만
// 사용한다. position: fixed라서 페이지 레이아웃을 밀어내지 않는다.

import { useEffect, useState } from "react";

export type TransientNoticeVariant = "success" | "error" | "info" | "warning";

export interface TransientNoticeProps {
  /** 표시할 메시지. null/undefined/빈 문자열이면 아무것도 렌더링하지 않는다. */
  message: string | null | undefined;
  variant?: TransientNoticeVariant;
  /** 자동으로 사라지기까지의 시간(ms). 기본 4000ms(4초). */
  durationMs?: number;
}

const VARIANT_CLASSES: Record<TransientNoticeVariant, string> = {
  success: "border-green-300 bg-green-50 text-green-800",
  error: "border-red-300 bg-red-50 text-red-800",
  info: "border-indigo-300 bg-indigo-50 text-indigo-800",
  warning: "border-amber-300 bg-amber-50 text-amber-800",
};

export function TransientNotice({ message, variant = "info", durationMs = 4000 }: TransientNoticeProps) {
  const [dismissed, setDismissed] = useState(false);
  // message가 바뀌면(=새 action 결과가 도착하면) 닫힘 상태를 초기화한다.
  // effect가 아니라 렌더 중에 직접 setState하는 "prop 변경에 맞춰 state를
  // 조정하는" 공식 패턴이다 — React가 커밋 전에 다시 렌더링해 준다.
  const [prevMessage, setPrevMessage] = useState(message);
  if (message !== prevMessage) {
    setPrevMessage(message);
    setDismissed(false);
  }

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setDismissed(true), durationMs);
    return () => clearTimeout(timer);
  }, [message, durationMs]);

  const visible = Boolean(message) && !dismissed;
  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed right-4 top-4 z-50 max-w-sm rounded border px-3 py-2 text-sm shadow-lg ${VARIANT_CLASSES[variant]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="flex-1">{message}</p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 text-xs font-medium opacity-70 hover:opacity-100"
          aria-label="닫기"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
