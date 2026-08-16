// Phase 3-20: A/B Testing Draft Structure.
// A/B test의 winner/판정 사유를 요약해 보여준다. 판정 결과가 있어도
// 자동 재게시로 이어지지 않는다는 안내를 항상 표시한다.

import type { SocialAbTest } from "@/lib/social/social-ab-testing-types";
import { buildSocialPostDetailUrl } from "@/lib/navigation/article-deep-links";

export function AbTestSummaryCard({ abTest }: { abTest: SocialAbTest }) {
  const hasResult = abTest.testStatus === "completed" || abTest.testStatus === "inconclusive" || abTest.winnerSocialPostId !== null;

  if (!hasResult) {
    return <p className="mt-2 text-xs text-zinc-500">아직 비교 결과가 없습니다. &ldquo;variant 비교&rdquo; 버튼으로 primary_metric 기준 비교를 실행하세요.</p>;
  }

  return (
    <div className="mt-2 rounded border border-zinc-200 bg-zinc-50 p-2 text-xs">
      <p className="font-medium text-zinc-700">
        판정: {abTest.testStatus === "inconclusive" ? "inconclusive (판단 보류)" : abTest.winnerSocialPostId ? "승자 결정됨" : "결과 없음"}
      </p>
      {abTest.winnerSocialPostId && (
        <p className="mt-1 text-zinc-600">
          winner social_post:{" "}
          <a href={buildSocialPostDetailUrl(abTest.winnerSocialPostId)} className="font-mono text-blue-600 hover:underline">
            {abTest.winnerSocialPostId}
          </a>
        </p>
      )}
      {abTest.winnerReason && <p className="mt-1 text-zinc-500">{abTest.winnerReason}</p>}
      <p className="mt-2 text-[11px] text-amber-700">
        ⚠ 이 판정은 수동 입력 metrics 기반 참고 지표입니다. 동일 조건의 A/B 테스트가 아닐 수 있으며, 어떤 경우에도 자동 재게시로 이어지지 않습니다.
      </p>
    </div>
  );
}
