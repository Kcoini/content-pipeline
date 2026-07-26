"use client";

// Phase 2-17: 실제 WordPress 공개(publish)처럼 되돌리기 어려운 작업을 실행하기
// 전에 사용자에게 다시 한번 확인받기 위한 버튼. 서버 액션(form action)과 함께
// 사용하며, 사용자가 확인 대화상자에서 취소하면 폼 제출 자체를 막는다.

import type { ReactNode } from "react";

interface ConfirmSubmitButtonProps {
  confirmMessage: string;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

export function ConfirmSubmitButton({ confirmMessage, disabled, className, children }: ConfirmSubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className={className}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
