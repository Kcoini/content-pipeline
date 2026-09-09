"use client";

// Phase 3-27: server action form을 제출한 뒤(응답이 올 때까지) 버튼이 그대로
// 눌러진 채로 남아 "무반응처럼 보이는" 문제를 막기 위한 최소 래퍼.
// `useFormStatus`는 감싸는 <form>의 pending 상태를 읽어오는 훅이라 이
// 컴포넌트 자체가 클라이언트 컴포넌트여야 한다(폼/페이지는 그대로 서버
// 컴포넌트로 둘 수 있다) — 이 버튼 하나만 "use client"로 분리했다.

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

interface PendingSubmitButtonProps {
  children: ReactNode;
  /** 제출 중일 때 보여줄 문구. 기본값: "처리 중...". */
  pendingLabel?: string;
  className?: string;
}

export function PendingSubmitButton({ children, pendingLabel = "처리 중...", className }: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={className}>
      {pending ? pendingLabel : children}
    </button>
  );
}
