// QA-01-FIX1/QA-01: app/articles/[id]/blog/page.tsx의 Step 6(게시 가능
// 상태 확인)에서 뽑아낸 공용 컴포넌트. platform publishing guard의
// blocked 사유를 raw count/필드명 없이 자연어로 보여준다. QA-01의
// browser smoke test가 실제 페이지와 같은 컴포넌트를 그대로 렌더링해
// 검증할 수 있도록 분리했다.

import type { PublishGuardIssueViewModel } from "@/lib/social/publish-guard-issue-view";

export function PublishGuardIssueList({ issues }: { issues: PublishGuardIssueViewModel[] }) {
  if (issues.length === 0) return null;

  return (
    <div className="mt-2 rounded border border-red-200 bg-red-50 p-2">
      <p className="text-[11px] font-medium text-red-800">게시 전에 확인할 사항이 {issues.length}개 있습니다.</p>
      <ul className="mt-1 list-inside list-disc text-[11px] text-red-700">
        {issues.map((issue) => (
          <li key={issue.key}>
            {issue.title}
            {issue.message && <span className="text-red-600"> — {issue.message}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
