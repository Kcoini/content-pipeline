// Phase 3-18: Social Post Detail Route & Pagination.
// /social-posts/[id] 상세 페이지 전용 navigation. 기사 하위 4개
// 페이지(blog/social/rewrite/performance)로 가는 링크 + "이전 위치로
// 돌아가기" + parent/root version 링크를 보여준다.

import Link from "next/link";
import { getSafeReturnTo } from "@/lib/navigation/return-to";
import { buildSocialPostDetailUrl } from "@/lib/navigation/article-deep-links";
import { getPlatformGroup } from "@/lib/social/content-type-classifier";
import type { SocialPlatform } from "@/lib/social/social-platform-types";

export interface SocialPostDetailNavigationProps {
  articleId: string;
  platform: SocialPlatform;
  isRewriteVersion: boolean;
  links: {
    articleOverview: string;
    articleBlog: string;
    articleSocial: string;
    articleRewrite: string;
    articlePerformance: string;
    parentSocialPostDetail: string | null;
    rootSocialPostDetail: string | null;
  };
  /** 현재 URL의 returnTo query. 안전한 내부 경로일 때만 "이전 위치로 돌아가기" 버튼을 표시한다. */
  returnTo?: string | null;
}

const BASE_TAB_CLASS = "rounded-full px-3 py-1.5 font-medium border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100";
const ACTIVE_TAB_CLASS = "rounded-full px-3 py-1.5 font-medium bg-zinc-900 text-white";

export function SocialPostDetailNavigation({ platform, isRewriteVersion, links, returnTo }: SocialPostDetailNavigationProps) {
  const platformGroup = getPlatformGroup(platform);
  const isBlogActive = !isRewriteVersion && platformGroup === "blog";
  const isSocialActive = !isRewriteVersion && (platformGroup === "social" || platformGroup === "community");
  const safeReturnTo = getSafeReturnTo(returnTo, "");

  return (
    <div className="flex flex-col gap-2">
      <nav className="flex flex-wrap gap-2 text-xs">
        <Link href={links.articleOverview} className={BASE_TAB_CLASS}>
          기사 개요
        </Link>
        <Link href={links.articleBlog} className={isBlogActive ? ACTIVE_TAB_CLASS : BASE_TAB_CLASS} aria-current={isBlogActive ? "page" : undefined}>
          블로그 페이지
        </Link>
        <Link href={links.articleSocial} className={isSocialActive ? ACTIVE_TAB_CLASS : BASE_TAB_CLASS} aria-current={isSocialActive ? "page" : undefined}>
          SNS/커뮤니티 페이지
        </Link>
        <Link href={links.articleRewrite} className={isRewriteVersion ? ACTIVE_TAB_CLASS : BASE_TAB_CLASS} aria-current={isRewriteVersion ? "page" : undefined}>
          Rewrite 페이지
        </Link>
        {/* 성과 링크는 rewrite 여부/platform과 무관하게 항상 표시한다. */}
        <Link href={links.articlePerformance} className={BASE_TAB_CLASS}>
          성과 페이지
        </Link>
      </nav>

      {(links.parentSocialPostDetail || links.rootSocialPostDetail || safeReturnTo) && (
        <div className="flex flex-wrap gap-2 text-xs">
          {links.parentSocialPostDetail && (
            <Link href={links.parentSocialPostDetail} className="rounded border border-indigo-300 bg-indigo-50 px-2 py-1 font-medium text-indigo-700 hover:bg-indigo-100">
              parent version 보기 →
            </Link>
          )}
          {links.rootSocialPostDetail && (
            <Link href={links.rootSocialPostDetail} className="rounded border border-indigo-300 bg-indigo-50 px-2 py-1 font-medium text-indigo-700 hover:bg-indigo-100">
              root version 보기 →
            </Link>
          )}
          {safeReturnTo && (
            <Link href={safeReturnTo} className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 font-medium text-zinc-600 hover:bg-zinc-100">
              ↩ 이전 위치로 돌아가기
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// 재사용 편의를 위해 detail URL 생성 함수도 함께 export한다 (테스트/다른 화면에서 참고용).
export { buildSocialPostDetailUrl };
