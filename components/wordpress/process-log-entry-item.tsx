// QA-01: app/articles/[id]/blog/page.tsx의 "프로세스 로그 / 실행 이력"
// 섹션 항목 렌더링을 뽑아낸 공용 컴포넌트. browser smoke test가 실제
// 페이지와 같은 컴포넌트를 렌더링해 "상세 JSON 보기가 기본 닫힘인지",
// "raw LogStatus가 그대로 노출되지 않는지"를 검증할 수 있게 한다.

import {
  describeProcessLogEntryStatus,
  WORDPRESS_BLOG_LOG_CATEGORY_LABELS,
  type WordPressBlogProcessLogEntry,
} from "@/lib/social/wordpress-blog-process-log-view";
import { describeStatusBadgeClass } from "@/lib/ui/status-badge-class";

export function ProcessLogEntryItem({ entry }: { entry: WordPressBlogProcessLogEntry }) {
  const statusLabel = describeProcessLogEntryStatus(entry);
  return (
    <li className="rounded border border-zinc-100 p-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-zinc-700">{entry.eventName}</span>
        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${describeStatusBadgeClass(statusLabel)}`}>
          {statusLabel}
        </span>
      </div>
      <p className="mt-0.5 text-zinc-600">{entry.message}</p>
      <p className="mt-0.5 text-zinc-400">
        {entry.createdAt} · {WORDPRESS_BLOG_LOG_CATEGORY_LABELS[entry.category]} · {entry.detailsSummary}
      </p>
      <details className="mt-0.5">
        <summary className="cursor-pointer text-zinc-400">상세 JSON 보기</summary>
        <pre className="mt-0.5 overflow-x-auto rounded bg-zinc-50 p-1 text-[9px] text-zinc-600">
          {JSON.stringify(entry.rawDetails, null, 2)}
        </pre>
      </details>
    </li>
  );
}
