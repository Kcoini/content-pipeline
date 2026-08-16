import Link from "next/link";

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

/** article 하위 페이지(개요/블로그/SNS·커뮤니티/rewrite/성과) 간 이동 네비게이션. active 탭을 강조 표시한다. */
export function ArticleWorkflowNavigation({ articleId, active }: { articleId: string; active: ArticleWorkflowTab }) {
  const tabs = getArticleWorkflowTabs(articleId);
  return (
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
  );
}
