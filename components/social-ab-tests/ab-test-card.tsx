// Phase 3-20: A/B Testing Draft Structure.
// A/B test draft 하나(+variant 목록+판정 요약)를 카드로 보여주고,
// 상태 전환 action 버튼을 제공한다. 자동 게시 버튼은 어디에도 없다 —
// variant 게시는 기존 blog/social 페이지의 승인/export/handoff/manual
// posting 흐름을 통해서만 이루어진다.

import type { ArticleAbTestListEntry } from "@/lib/social/article-ab-tests-page-service";
import { AbTestVariantTable } from "./ab-test-variant-table";
import { AbTestSummaryCard } from "./ab-test-summary-card";
import {
  markAbTestReadyAction,
  startAbTestAction,
  pauseAbTestAction,
  completeAbTestAction,
  cancelAbTestAction,
  refreshAbTestMetricsAction,
  compareAbTestVariantsAction,
} from "../../app/articles/[id]/actions";

const TEST_STATUS_STYLES: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-600",
  ready: "bg-blue-100 text-blue-700",
  running: "bg-indigo-100 text-indigo-700",
  paused: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  inconclusive: "bg-zinc-100 text-zinc-500",
  cancelled: "bg-zinc-100 text-zinc-400",
  blocked: "bg-red-100 text-red-700",
  failed: "bg-red-100 text-red-700",
};

export function AbTestCard({
  articleId,
  entry,
  returnTo,
  highlighted = false,
}: {
  articleId: string;
  entry: ArticleAbTestListEntry;
  returnTo?: string;
  highlighted?: boolean;
}) {
  const { abTest, variants } = entry;

  return (
    <li
      id={`ab-test-${abTest.id}`}
      className={`rounded border border-zinc-200 p-3 text-xs ${highlighted ? "ring-2 ring-indigo-500 ring-offset-2" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${TEST_STATUS_STYLES[abTest.testStatus] ?? "bg-zinc-100 text-zinc-600"}`}>
          {abTest.testStatus}
        </span>
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-zinc-600">{abTest.testType}</span>
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-zinc-600">{abTest.platform}</span>
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-500">primary: {abTest.primaryMetric}</span>
        <span className="text-[11px] text-zinc-400">variant {variants.length}개</span>
      </div>

      <p className="mt-1 font-medium text-zinc-700">{abTest.testName}</p>
      {abTest.testDescription && <p className="mt-1 text-zinc-500">{abTest.testDescription}</p>}
      {abTest.hypothesis && <p className="mt-1 text-zinc-500">가설: {abTest.hypothesis}</p>}
      {abTest.testGoal && <p className="mt-1 text-zinc-500">목적: {abTest.testGoal}</p>}
      <p className="mt-1 text-[11px] text-zinc-400">
        생성: {new Date(abTest.createdAt).toLocaleString("ko-KR")} · 수정: {new Date(abTest.updatedAt).toLocaleString("ko-KR")}
      </p>

      <AbTestSummaryCard abTest={abTest} />
      <AbTestVariantTable variants={variants} />

      <div className="mt-2 flex flex-wrap gap-2">
        <form action={markAbTestReadyAction}>
          <input type="hidden" name="articleId" value={articleId} />
          <input type="hidden" name="abTestId" value={abTest.id} />
          {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
          <button
            type="submit"
            disabled={abTest.testStatus !== "draft"}
            className="rounded border border-blue-300 bg-blue-50 px-2 py-1 font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ready로 변경
          </button>
        </form>
        <form action={startAbTestAction}>
          <input type="hidden" name="articleId" value={articleId} />
          <input type="hidden" name="abTestId" value={abTest.id} />
          {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
          <button
            type="submit"
            disabled={abTest.testStatus !== "ready" && abTest.testStatus !== "paused"}
            className="rounded border border-indigo-300 bg-indigo-50 px-2 py-1 font-medium text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            running 시작
          </button>
        </form>
        <form action={pauseAbTestAction}>
          <input type="hidden" name="articleId" value={articleId} />
          <input type="hidden" name="abTestId" value={abTest.id} />
          {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
          <button
            type="submit"
            disabled={abTest.testStatus !== "running"}
            className="rounded border border-amber-300 bg-amber-50 px-2 py-1 font-medium text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            일시정지
          </button>
        </form>
        <form action={refreshAbTestMetricsAction}>
          <input type="hidden" name="articleId" value={articleId} />
          <input type="hidden" name="abTestId" value={abTest.id} />
          {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
          <button type="submit" className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-100">
            metrics 새로고침
          </button>
        </form>
        <form action={compareAbTestVariantsAction}>
          <input type="hidden" name="articleId" value={articleId} />
          <input type="hidden" name="abTestId" value={abTest.id} />
          {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
          <button
            type="submit"
            disabled={variants.length < 2}
            className="rounded border border-purple-300 bg-purple-50 px-2 py-1 font-medium text-purple-700 hover:bg-purple-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            variant 비교
          </button>
        </form>
        <form action={completeAbTestAction}>
          <input type="hidden" name="articleId" value={articleId} />
          <input type="hidden" name="abTestId" value={abTest.id} />
          {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
          <button
            type="submit"
            disabled={abTest.testStatus !== "running" && abTest.testStatus !== "paused"}
            className="rounded border border-green-300 bg-green-50 px-2 py-1 font-medium text-green-700 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            완료 처리
          </button>
        </form>
        <form action={cancelAbTestAction} className="flex items-center gap-1">
          <input type="hidden" name="articleId" value={articleId} />
          <input type="hidden" name="abTestId" value={abTest.id} />
          {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
          <input name="reason" placeholder="취소 사유(선택)" className="rounded border border-zinc-300 px-1.5 py-1" />
          <button
            type="submit"
            disabled={abTest.testStatus === "completed" || abTest.testStatus === "cancelled"}
            className="rounded border border-red-300 bg-red-50 px-2 py-1 font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            취소
          </button>
        </form>
      </div>
    </li>
  );
}
