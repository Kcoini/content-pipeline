// Phase 3-19: Dashboard Charts & Trend Visualization.
// 모든 차트 컴포넌트를 감싸는 공통 카드 wrapper. 제목/설명/안내 배지를
// 일관되게 보여주고, collapsible=true면 <details>로 접을 수 있게 한다
// (차트가 많아져도 첫 화면이 너무 길어지지 않도록).

import type { ReactNode } from "react";

export function ChartSection({
  title,
  description,
  note,
  collapsible = false,
  defaultOpen = true,
  children,
}: {
  title: string;
  description?: string;
  /** "수동 입력 metrics 기반입니다" 같은 한계/주의 안내. */
  note?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const body = (
    <>
      {description && <p className="mt-1 text-[11px] text-zinc-500">{description}</p>}
      {note && <p className="mt-1 text-[11px] text-amber-700">⚠ {note}</p>}
      <div className="mt-3">{children}</div>
    </>
  );

  if (collapsible) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <details open={defaultOpen}>
          <summary className="cursor-pointer text-sm font-semibold text-zinc-700">{title}</summary>
          {body}
        </details>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-700">{title}</h2>
      {body}
    </section>
  );
}
