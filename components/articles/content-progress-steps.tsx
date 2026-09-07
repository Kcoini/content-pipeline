// Phase 3-22: 콘텐츠 생성 흐름 관련 화면(테마/원고/블로그/SNS) 상단에
// 공통으로 보여주는 진행 단계 표시. 개발자용 상태값(quality_status 등)이
// 아니라 사용자가 이해할 수 있는 5단계만 보여준다. 서버 컴포넌트에서
// 그대로 쓸 수 있는 순수 표시용 컴포넌트다(클라이언트 상태 없음).

export type ContentProgressStep = "theme" | "sources" | "generate" | "review" | "publish_ready";

const STEPS: { key: ContentProgressStep; label: string }[] = [
  { key: "theme", label: "테마 선택" },
  { key: "sources", label: "출처 입력" },
  { key: "generate", label: "글 생성" },
  { key: "review", label: "검토/승인" },
  { key: "publish_ready", label: "게시 준비" },
];

export function ContentProgressSteps({ current }: { current: ContentProgressStep }) {
  const currentIndex = STEPS.findIndex((step) => step.key === current);

  return (
    <nav aria-label="콘텐츠 생성 진행 단계" className="flex flex-wrap items-center gap-1 text-xs">
      {STEPS.map((step, index) => {
        const isCurrent = index === currentIndex;
        const isDone = currentIndex >= 0 && index < currentIndex;
        return (
          <span key={step.key} className="flex items-center gap-1">
            <span
              className={
                isCurrent
                  ? "rounded-full bg-indigo-600 px-2.5 py-1 font-semibold text-white"
                  : isDone
                    ? "rounded-full bg-indigo-100 px-2.5 py-1 font-medium text-indigo-700"
                    : "rounded-full bg-zinc-100 px-2.5 py-1 text-zinc-500"
              }
            >
              {step.label}
            </span>
            {index < STEPS.length - 1 && <span className="text-zinc-300">→</span>}
          </span>
        );
      })}
    </nav>
  );
}
