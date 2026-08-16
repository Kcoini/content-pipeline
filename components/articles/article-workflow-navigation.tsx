import Link from "next/link";
import { getSafeReturnTo } from "@/lib/navigation/return-to";
import { buildArticleOverviewUrl } from "@/lib/navigation/article-deep-links";

export type ArticleWorkflowTab = "overview" | "blog" | "social" | "rewrite" | "performance";

const TAB_DEFS: { key: ArticleWorkflowTab; label: string; hrefSuffix: string }[] = [
  { key: "overview", label: "기사 개요", hrefSuffix: "" },
  { key: "blog", label: "블로그 글쓰기", hrefSuffix: "/blog" },
  { key: "social", label: "SNS/커뮤니티 글쓰기", hrefSuffix: "/social" },
  { key: "rewrite", label: "Rewrite 관리", hrefSuffix: "/rewrite" },
  { key: "performance", label: "성과 보기", hrefSuffix: "/performance" },
];

export interface ArticleWorkflowTabLink {
  key: ArticleWorkflowTab;
  label: string;
  href: string;
}

/** articleId 기준으로 5개 하위 페이지의 URL을 생성한다 (렌더링 없이 테스트 가능). */
export function getArticleWorkflowTabs(articleId: string): ArticleWorkflowTabLink[] {
  return TAB_DEFS.map((tab) => ({ key: tab.key, label: tab.label, href: `/articles/${articleId}${tab.hrefSuffix}` }));
}

/**
 * article 하위 페이지(개요/블로그/SNS·커뮤니티/rewrite/성과) 간 이동 네비게이션.
 * active 탭을 강조 표시한다. 탭 링크 자체에는 returnTo를 붙이지 않는다 —
 * 대신 "기사 개요로 돌아가기"(항상)와 "이전 작업 위치로 돌아가기"(returnTo가
 * 안전할 때만) 버튼을 별도로 제공한다 (Phase 3-17).
 */
export function ArticleWorkflowNavigation({
  articleId,
  active,
  returnTo,
}: {
  articleId: string;
  active: ArticleWorkflowTab;
  /** 현재 페이지가 이 값을 넘겨받았다면(query의 returnTo) "이전 작업 위치로 돌아가기" 버튼에 사용한다. */
  returnTo?: string | null;
}) {
  const tabs = getArticleWorkflowTabs(articleId);
  const safeReturnTo = getSafeReturnTo(returnTo, "");

  return (
    <div className="flex flex-col gap-2">
      <nav className="flex flex-wrap gap-2 text-xs">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={tab.key === active ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 font-medium ${
              tab.key === active ? "bg-zinc-900 text-white" : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {(active !== "overview" || safeReturnTo) && (
        <div className="flex flex-wrap gap-2 text-xs">
          {active !== "overview" && (
            <Link
              href={buildArticleOverviewUrl(articleId)}
              className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 font-medium text-zinc-600 hover:bg-zinc-100"
            >
              ← 기사 개요로 돌아가기
            </Link>
          )}
          {safeReturnTo && (
            <Link
              href={safeReturnTo}
              className="rounded border border-indigo-300 bg-indigo-50 px-2 py-1 font-medium text-indigo-700 hover:bg-indigo-100"
            >
              ↩ 이전 작업 위치로 돌아가기
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
