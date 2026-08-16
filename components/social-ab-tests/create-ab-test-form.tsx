// Phase 3-20: A/B Testing Draft Structure.
// 일반 A/B test draft(테스트 계획)를 생성하는 폼. 제출해도 실제
// 플랫폼에 아무것도 게시되지 않는다 — draft 한 건이 생성될 뿐이다.

import { SOCIAL_PLATFORMS } from "@/lib/social/social-platform-types";
import { createAbTestDraftAction } from "../../app/articles/[id]/actions";

const PRIMARY_METRICS = [
  "performance_score",
  "views",
  "impressions",
  "engagement_rate",
  "click_through_rate",
  "clicks",
  "comments",
  "shares",
  "saves",
  "conversion_rate",
] as const;

const TEST_TYPES = ["manual", "title_test", "hook_test", "cta_test", "tone_test", "platform_test", "hashtag_test"] as const;

export function CreateAbTestForm({ articleId, returnTo }: { articleId: string; returnTo?: string }) {
  return (
    <form action={createAbTestDraftAction} className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
      <input type="hidden" name="articleId" value={articleId} />
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      <label className="flex flex-col gap-1">
        platform
        <select name="platform" required className="rounded border border-zinc-300 px-2 py-1">
          {SOCIAL_PLATFORMS.map((platform) => (
            <option key={platform} value={platform}>
              {platform}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        test_type
        <select name="testType" defaultValue="manual" className="rounded border border-zinc-300 px-2 py-1">
          {TEST_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 sm:col-span-2">
        test_name *
        <input name="testName" required placeholder="예: 제목 후크 A/B (WordPress)" className="rounded border border-zinc-300 px-2 py-1" />
      </label>
      <label className="flex flex-col gap-1 sm:col-span-2">
        test_description
        <input name="testDescription" placeholder="이 테스트에서 무엇을 바꿔 비교하는지" className="rounded border border-zinc-300 px-2 py-1" />
      </label>
      <label className="flex flex-col gap-1 sm:col-span-2">
        가설 (hypothesis)
        <input name="hypothesis" placeholder="예: 질문형 제목이 평서문보다 클릭률이 높을 것이다" className="rounded border border-zinc-300 px-2 py-1" />
      </label>
      <label className="flex flex-col gap-1 sm:col-span-2">
        목적 (test_goal)
        <input name="testGoal" placeholder="예: 클릭률 개선" className="rounded border border-zinc-300 px-2 py-1" />
      </label>
      <label className="flex flex-col gap-1">
        primary_metric
        <select name="primaryMetric" defaultValue="performance_score" className="rounded border border-zinc-300 px-2 py-1">
          {PRIMARY_METRICS.map((metric) => (
            <option key={metric} value={metric}>
              {metric}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-end">
        <button type="submit" className="rounded bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-700">
          A/B test draft 생성
        </button>
      </div>
    </form>
  );
}
