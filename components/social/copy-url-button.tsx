"use client";

// wordpress_blog 카드 Step 7 "게시 URL 복사" 버튼. 서버에 아무것도
// 기록하지 않고(복사 여부는 URL 존재만으로 이미 completed로 계산되므로
// 별도 저장이 필요 없다), navigator.clipboard로 클립보드에 복사한
// 뒤 로컬 상태로만 성공/실패 메시지를 보여준다.

import { useState } from "react";

interface CopyUrlButtonProps {
  url: string;
  className?: string;
}

export function CopyUrlButton({ url, className }: CopyUrlButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        className={className}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setStatus("copied");
          } catch {
            setStatus("error");
          }
        }}
      >
        {status === "copied" ? "복사됨" : "게시 URL 복사"}
      </button>
      {status === "error" && (
        <span className="text-[10px] text-red-600">복사에 실패했습니다. URL을 직접 선택해 복사하세요.</span>
      )}
    </span>
  );
}
