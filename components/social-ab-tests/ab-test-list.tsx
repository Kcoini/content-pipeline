// Phase 3-20: A/B Testing Draft Structure.
// article 하나에 속한 A/B test draft 목록을 렌더링한다.

import type { ArticleAbTestListEntry } from "@/lib/social/article-ab-tests-page-service";
import { AbTestCard } from "./ab-test-card";

export function AbTestList({
  articleId,
  entries,
  returnTo,
  highlightAbTestId,
}: {
  articleId: string;
  entries: ArticleAbTestListEntry[];
  returnTo?: string;
  /** abTestId deep link(?abTestId=...)로 들어왔을 때 강조할 테스트 id. */
  highlightAbTestId?: string;
}) {
  if (entries.length === 0) {
    return <p className="mt-2 text-xs text-zinc-500">아직 생성된 A/B test draft가 없습니다. 아래 폼으로 새 draft를 만들어보세요.</p>;
  }

  return (
    <ul className="mt-2 flex flex-col gap-3">
      {entries.map((entry) => (
        <AbTestCard key={entry.abTest.id} articleId={articleId} entry={entry} returnTo={returnTo} highlighted={entry.abTest.id === highlightAbTestId} />
      ))}
    </ul>
  );
}
