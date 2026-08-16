// Phase 3-15: Social Performance Dashboard 공용 상태 배지.

import type { SocialPlatform } from "@/lib/social/social-platform-types";
import { buildSocialPostDeepLink, buildRewriteVersionDeepLink } from "@/lib/navigation/article-deep-links";

export function PerformanceStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    excellent: "bg-green-100 text-green-700",
    good: "bg-blue-100 text-blue-700",
    average: "bg-zinc-100 text-zinc-700",
    low: "bg-amber-100 text-amber-700",
    needs_review: "bg-red-100 text-red-700",
    not_measured: "bg-zinc-100 text-zinc-500",
  };
  return (
    <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${styles[status] ?? "bg-zinc-100 text-zinc-600"}`}>
      {status}
    </span>
  );
}

export function ManualPostStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    posted: "bg-green-100 text-green-700",
    not_recorded: "bg-zinc-100 text-zinc-600",
    ready_to_record: "bg-blue-100 text-blue-700",
    failed: "bg-red-100 text-red-700",
    skipped: "bg-amber-100 text-amber-700",
    blocked: "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${styles[status] ?? "bg-zinc-100 text-zinc-600"}`}>
      {status}
    </span>
  );
}

export function RewriteComparisonStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    rewrite_won: "bg-green-100 text-green-700",
    original_won: "bg-amber-100 text-amber-700",
    similar: "bg-zinc-100 text-zinc-700",
    needs_more_data: "bg-blue-100 text-blue-700",
    inconclusive: "bg-zinc-100 text-zinc-600",
    blocked: "bg-red-100 text-red-700",
    failed: "bg-red-100 text-red-700",
    not_compared: "bg-zinc-100 text-zinc-500",
  };
  return (
    <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${styles[status] ?? "bg-zinc-100 text-zinc-600"}`}>
      {status}
    </span>
  );
}

export function RecommendationBadge({ label }: { label: "Best Platform" | "Best Tone" | "Low Performance" | "Metrics Missing" | "Rewrite Won" | "Needs Review" }) {
  const styles: Record<string, string> = {
    "Best Platform": "bg-indigo-100 text-indigo-700",
    "Best Tone": "bg-indigo-100 text-indigo-700",
    "Low Performance": "bg-amber-100 text-amber-700",
    "Metrics Missing": "bg-zinc-100 text-zinc-600",
    "Rewrite Won": "bg-green-100 text-green-700",
    "Needs Review": "bg-red-100 text-red-700",
  };
  return <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${styles[label]}`}>{label}</span>;
}

/**
 * social_post(또는 rewrite version) 상세로 이동하는 deep link (Phase 3-17).
 * 전용 상세 라우트(`/social-posts/[id]`)가 아직 없으므로 platform/
 * isRewriteVersion에 맞는 하위 페이지(blog/social/rewrite)로 이동하며
 * 해당 카드를 강조(highlight)한다. platform/isRewriteVersion을 모두
 * 알 수 없는 경우에만 기사 개요 페이지로 보낸다.
 */
export function socialPostHref(
  articleId: string,
  socialPostId: string,
  options?: { platform?: SocialPlatform; isRewriteVersion?: boolean }
): string {
  if (options?.isRewriteVersion) return buildRewriteVersionDeepLink(articleId, socialPostId);
  if (options?.platform) return buildSocialPostDeepLink(articleId, options.platform, socialPostId);
  return `/articles/${articleId}?socialPostId=${socialPostId}&highlight=${socialPostId}`;
}
