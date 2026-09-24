"use client";

// PRODUCT-01G 섹션 23: 이 프로젝트에는 이전까지 error.tsx가 없었다 —
// 렌더링 중 예상치 못한 예외가 발생하면 Next.js 기본 에러 화면(raw,
// 안내/복귀 링크 없음)에 의존하고 있었다. Next.js는 이 파일을 반드시
// Client Component로 요구한다. reset()은 이 boundary 아래 트리만 다시
// 렌더링한다(페이지 전체 새로고침이 아님) — 실제로 안전하게 재시도할
// 수 있는 동작이라 "다시 시도" 버튼에 그대로 연결한다.
//
// error.digest는 Next.js가 서버 로그와 이 화면을 연결하기 위해 만드는
// 짧은 참조 값이다(섹션 26) — DB UUID/raw stack이 아니라 Next.js
// 자체가 생성하는 진단용 참조 id이므로 노출해도 안전하다.

import { useEffect } from "react";
import { describeUnexpectedError } from "@/lib/errors/describe-unexpected-error";
import { AdvancedDetails } from "@/components/common/advanced-details";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 사용자에게 보여주는 문구와 별개로, 실제 에러는 브라우저 콘솔에
    // 남겨 진단에 쓸 수 있게 한다(secret/full body 없음, 표준 Error
    // 객체만).
    console.error(error);
  }, [error]);

  const friendlyMessage = describeUnexpectedError(
    error.message,
    "화면을 표시하는 중 문제가 발생했습니다."
  ).userMessage;

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <p className="text-base font-semibold text-zinc-800">문제가 발생했습니다.</p>
        <p className="mt-2 break-keep text-sm text-zinc-600">{friendlyMessage}</p>
        {/* 이 boundary는 앱 전체 어디서든 발생한 예외를 잡는다 — 저장이
            실제로 끝났는지 화면마다 다르므로, 여기서는 보장할 수 없는
            데이터 안전 문구를 추측해서 넣지 않는다(섹션 3/8). 저장
            여부가 확실한 화면(WordPress Draft 실패 등)에서는 각 페이지가
            직접 안내한다. */}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            다시 시도
          </button>
          <a
            href="/dashboard"
            className="rounded border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          >
            내 콘텐츠로 돌아가기
          </a>
        </div>
        {error.digest && (
          <AdvancedDetails title="문제가 계속되면 관리자에게 전달할 참조 번호" className="mt-4 text-left">
            <p className="break-all text-[11px] text-zinc-500">{error.digest}</p>
          </AdvancedDetails>
        )}
      </div>
    </div>
  );
}
