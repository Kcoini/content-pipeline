// Phase 3-20: A/B Testing Draft Structure.
// 원본 social_post와 rewrite social_post를 곧바로 control/variant_a로
// 묶는 A/B test draft를 생성하는 폼(Phase 3-14 rewrite comparison
// 구조 재사용). 제출해도 실제 게시는 수행되지 않는다.

import type { SocialPost } from "@/lib/social/social-platform-types";
import { createOriginalVsRewriteAbTestAction } from "../../app/articles/[id]/actions";

export function OriginalVsRewriteTestForm({
  articleId,
  allPosts,
  defaultOriginalSocialPostId,
  defaultRewriteSocialPostId,
  returnTo,
}: {
  articleId: string;
  allPosts: SocialPost[];
  defaultOriginalSocialPostId?: string;
  defaultRewriteSocialPostId?: string;
  returnTo?: string;
}) {
  const originalCandidates = allPosts.filter((p) => !p.isRewriteVersion);
  const rewriteCandidates = allPosts.filter((p) => p.isRewriteVersion);

  if (rewriteCandidates.length === 0) {
    return <p className="mt-2 text-xs text-zinc-500">아직 이 기사에 rewrite version이 없습니다. Rewrite 페이지에서 개선안을 먼저 적용하세요.</p>;
  }

  return (
    <form action={createOriginalVsRewriteAbTestAction} className="mt-2 flex flex-wrap items-end gap-2 text-xs">
      <input type="hidden" name="articleId" value={articleId} />
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      <label className="flex flex-col gap-1">
        원본 social_post
        <select name="originalSocialPostId" defaultValue={defaultOriginalSocialPostId ?? ""} required className="rounded border border-zinc-300 px-2 py-1">
          <option value="" disabled>
            선택하세요
          </option>
          {originalCandidates.map((p) => (
            <option key={p.id} value={p.id}>
              {p.platform} · {p.postTitle || p.caption || p.id}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        rewrite social_post
        <select name="rewriteSocialPostId" defaultValue={defaultRewriteSocialPostId ?? ""} required className="rounded border border-zinc-300 px-2 py-1">
          <option value="" disabled>
            선택하세요
          </option>
          {rewriteCandidates.map((p) => (
            <option key={p.id} value={p.id}>
              v{p.versionNumber} · {p.platform} · {p.postTitle || p.caption || p.id}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        test_name (선택)
        <input name="testName" placeholder="비워두면 자동 생성" className="rounded border border-zinc-300 px-2 py-1" />
      </label>
      <button type="submit" className="rounded bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-500">
        원본 vs Rewrite test 생성
      </button>
    </form>
  );
}
