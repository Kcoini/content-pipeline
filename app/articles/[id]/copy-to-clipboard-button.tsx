"use client";

// Phase 3-5: manual export 결과를 클립보드로 복사하는 버튼. 복사가 끝나면
// 같은 폼을 제출해 서버 액션(recordSocialPostCopiedAction)으로 복사
// 여부만 기록한다 — 복사한 텍스트 전문은 서버로 보내지 않는다.

interface CopyToClipboardButtonProps {
  text: string;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function CopyToClipboardButton({ text, disabled, className, children }: CopyToClipboardButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled || text.trim().length === 0}
      className={className}
      onClick={async (event) => {
        event.preventDefault();
        // React가 이벤트를 재사용(pooling)하므로 await 이후에는
        // event.currentTarget이 null이 될 수 있다 — await 전에 미리 참조를 잡아둔다.
        const form = event.currentTarget.form;
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          // 클립보드 접근이 차단된 환경일 수 있으므로 복사 실패해도 기록은 시도한다.
        }
        form?.requestSubmit();
      }}
    >
      {children}
    </button>
  );
}
