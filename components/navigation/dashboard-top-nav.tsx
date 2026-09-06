"use client";

// Phase 1-22: 상단 내비게이션 단순화.
// 이전에는 /dashboard 헤더에 버튼 8개(자동 테마 찾기/기사 목록 보기/
// Social Performance Dashboard/Content Dashboard/Blog Dashboard/
// Rewrite Dashboard/Platform API Readiness/Automation Safety)가 한 줄에
// 나열되어 있었다. 항상 보이는 버튼은 "자동 테마 찾기"/"기사 목록" 2개로
// 줄이고, 나머지(대시보드/운영 메뉴)는 드롭다운 안으로 옮긴다.
//
// 새 UI 라이브러리는 추가하지 않는다 — 순수 React state + 이벤트
// 리스너만으로 드롭다운(열기/닫기, Esc, 바깥 클릭)을 구현한다.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/** 상단 내비게이션이 알고 있는 라우트 키. 각 페이지가 자신의 active 상태를 이 키로 넘긴다. */
export type DashboardTopNavActive =
  | "trends"
  | "articles"
  | "content"
  | "blog"
  | "rewrite"
  | "social-performance"
  | "platform-api"
  | "automation-safety"
  | null;

export interface DashboardMenuItem {
  key: Exclude<DashboardTopNavActive, "trends" | "articles" | null>;
  href: string;
  label: string;
  /** 위험/운영 성격 메뉴 — 항상 강한 색으로 노출하지 않고, 메뉴 안에서만 옅게 구분한다. */
  danger?: boolean;
}

export interface DashboardMenuGroup {
  title: string;
  items: DashboardMenuItem[];
}

/**
 * 드롭다운 메뉴 구성 — 역할별로 묶는다(콘텐츠 관리/성과 분석/운영 설정).
 * 영문 버튼명은 한국어로 통일한다(Content Dashboard → 콘텐츠 현황 등).
 */
export const DASHBOARD_MENU_GROUPS: DashboardMenuGroup[] = [
  {
    title: "콘텐츠 관리",
    items: [
      { key: "content", href: "/dashboard/content", label: "콘텐츠 현황" },
      { key: "blog", href: "/dashboard/blog", label: "블로그 현황" },
      { key: "rewrite", href: "/dashboard/rewrite", label: "리라이트 관리" },
    ],
  },
  {
    title: "성과 분석",
    items: [{ key: "social-performance", href: "/dashboard/social-performance", label: "소셜 성과" }],
  },
  {
    title: "운영 설정",
    items: [
      { key: "platform-api", href: "/dashboard/platform-api", label: "API 연동 준비" },
      { key: "automation-safety", href: "/dashboard/automation-safety", label: "자동화 안전", danger: true },
    ],
  },
];

/** 드롭다운 메뉴 항목 중 하나라도 active인지 확인한다(트리거 버튼 자체를 강조할 때 사용). */
function isAnyMenuItemActive(active: DashboardTopNavActive): boolean {
  return DASHBOARD_MENU_GROUPS.some((group) => group.items.some((item) => item.key === active));
}

const PRIMARY_ACTIVE_CLASS = "border-zinc-900 bg-zinc-900 text-white";
const PRIMARY_INACTIVE_CLASS = "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100";

export interface DashboardTopNavProps {
  /** 현재 페이지가 이 내비게이션의 어떤 항목에 해당하는지(없으면 null). */
  active: DashboardTopNavActive;
}

/**
 * 상단 내비게이션 — 항상 보이는 것은 "자동 테마 찾기"/"기사 목록"
 * 2개(+대시보드 메뉴 트리거)뿐이다. 나머지 대시보드/운영 메뉴는
 * 드롭다운 안에서 역할별로 확인한다. 라우팅 대상은 그대로이고, 버튼
 * 위치만 옮겼다 — 페이지는 하나도 삭제하지 않았다.
 */
export function DashboardTopNav({ active }: DashboardTopNavProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const menuTriggerActive = active === null ? false : isAnyMenuItemActive(active);

  return (
    <div ref={containerRef} className="relative flex shrink-0 items-center gap-2">
      <Link
        href="/trends"
        aria-current={active === "trends" ? "page" : undefined}
        className={`rounded border px-3 py-1.5 text-sm font-medium ${
          active === "trends" ? "border-blue-600 bg-blue-600 text-white" : "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
        }`}
      >
        자동 테마 찾기
      </Link>
      {/* 모바일에서는 "기사 목록"을 숨기고 메뉴 안에서만 접근한다(상단에는
          primary action 1개 + 메뉴 1개만 남긴다). */}
      <Link
        href="/articles"
        aria-current={active === "articles" ? "page" : undefined}
        className={`hidden rounded border px-3 py-1.5 text-sm font-medium sm:inline-flex ${
          active === "articles" ? PRIMARY_ACTIVE_CLASS : PRIMARY_INACTIVE_CLASS
        }`}
      >
        기사 목록
      </Link>

      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="dashboard-top-nav-menu"
        onClick={() => setOpen((prev) => !prev)}
        className={`rounded border px-3 py-1.5 text-sm font-medium ${
          menuTriggerActive ? PRIMARY_ACTIVE_CLASS : PRIMARY_INACTIVE_CLASS
        }`}
      >
        <span className="hidden sm:inline">대시보드</span>
        <span className="sm:hidden">메뉴</span> ▾
      </button>

      {open && (
        <div
          id="dashboard-top-nav-menu"
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-zinc-200 bg-white p-2 shadow-lg"
        >
          {/* 모바일에서만 보이는 "기사 목록" — 상단 primary 자리에서 숨긴 것을 메뉴 안에서 되돌려준다. */}
          <Link
            href="/articles"
            role="menuitem"
            aria-current={active === "articles" ? "page" : undefined}
            className={`block rounded px-2 py-1.5 text-sm sm:hidden ${
              active === "articles" ? "bg-zinc-100 font-semibold text-zinc-900" : "text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            기사 목록
          </Link>

          {DASHBOARD_MENU_GROUPS.map((group) => (
            <div key={group.title} className="mt-1.5 first:mt-0">
              <p className="px-2 pt-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">{group.title}</p>
              {group.items.map((item) => {
                const isActive = item.key === active;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    role="menuitem"
                    aria-current={isActive ? "page" : undefined}
                    className={`block rounded px-2 py-1.5 text-sm ${
                      isActive
                        ? "bg-zinc-100 font-semibold text-zinc-900"
                        : item.danger
                          ? "text-red-700 hover:bg-red-50"
                          : "text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
