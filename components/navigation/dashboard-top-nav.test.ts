import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DASHBOARD_MENU_GROUPS } from "./dashboard-top-nav";

const componentSource = readFileSync(path.join(__dirname, "dashboard-top-nav.tsx"), "utf8");

describe("DASHBOARD_MENU_GROUPS (Phase 1-22: 상단 내비게이션 단순화)", () => {
  it("모든 기존 대시보드 페이지로 이동하는 항목을 포함한다(라우팅 유지, 페이지 삭제 없음)", () => {
    const hrefs = DASHBOARD_MENU_GROUPS.flatMap((group) => group.items.map((item) => item.href));
    expect(hrefs).toEqual(
      expect.arrayContaining([
        "/dashboard/content",
        "/dashboard/blog",
        "/dashboard/rewrite",
        "/dashboard/social-performance",
        "/dashboard/settings",
        "/dashboard/platform-api",
        "/dashboard/automation-safety",
      ])
    );
  });

  // PRODUCT-01D
  it("'설정' 메뉴는 /dashboard/settings로 연결되고 user audience 그룹에 있다", () => {
    const settingsGroup = DASHBOARD_MENU_GROUPS.find((g) => g.items.some((item) => item.key === "settings"));
    expect(settingsGroup).toBeDefined();
    expect(settingsGroup!.audience).toBe("user");
    const settingsItem = settingsGroup!.items.find((item) => item.key === "settings");
    expect(settingsItem!.href).toBe("/dashboard/settings");
    expect(settingsItem!.label).toBe("설정");
  });

  it("영문 버튼명을 한국어 라벨로 통일한다", () => {
    const labels = DASHBOARD_MENU_GROUPS.flatMap((group) => group.items.map((item) => item.label));
    expect(labels).toEqual(
      expect.arrayContaining(["콘텐츠 현황", "블로그 현황", "리라이트 관리", "소셜 성과", "API 연동 준비 상태", "자동화 안전 점검"])
    );
    for (const label of labels) {
      // "API"처럼 널리 쓰이는 영문 약어는 허용하되, 예전의 영문 버튼명
      // (Dashboard/Readiness/Safety 등)은 더 이상 쓰이지 않는다.
      expect(label).not.toMatch(/Dashboard|Readiness|Safety/i);
    }
  });

  it("역할별 그룹(콘텐츠 관리/성과 분석/설정/관리자·고급)으로 나뉜다", () => {
    const groupTitles = DASHBOARD_MENU_GROUPS.map((group) => group.title);
    expect(groupTitles).toEqual(["콘텐츠 관리", "성과 분석", "설정", "관리자 / 고급"]);
  });

  // PRODUCT-01B: navigation을 INTERNAL_USER/ADMIN 두 audience로 분리한다
  // (auth/RBAC는 아직 구현하지 않는다 — 정보 구조만 나눈다).
  // PRODUCT-01D: "설정"(일반 사용자용 Settings)도 user 그룹에 추가한다.
  it("콘텐츠 관리/성과 분석/설정은 audience='user', 관리자/고급은 audience='admin'이다", () => {
    const byTitle = Object.fromEntries(DASHBOARD_MENU_GROUPS.map((g) => [g.title, g.audience]));
    expect(byTitle["콘텐츠 관리"]).toBe("user");
    expect(byTitle["성과 분석"]).toBe("user");
    expect(byTitle["설정"]).toBe("user");
    expect(byTitle["관리자 / 고급"]).toBe("admin");
  });

  it("자동화 안전 점검(위험/운영 메뉴)은 danger로 표시되지만 관리자/고급 그룹 안에 있다(상단에 항상 노출되지 않는다)", () => {
    const adminGroup = DASHBOARD_MENU_GROUPS.find((group) => group.title === "관리자 / 고급");
    expect(adminGroup).toBeDefined();
    const automationSafety = adminGroup!.items.find((item) => item.key === "automation-safety");
    expect(automationSafety).toBeDefined();
    expect(automationSafety!.danger).toBe(true);
  });

  it("관리자/고급 그룹에는 platform-api/automation-safety만 있고, 삭제된 route는 없다(경로 유지 확인)", () => {
    const adminGroup = DASHBOARD_MENU_GROUPS.find((group) => group.title === "관리자 / 고급");
    expect(adminGroup!.items.map((item) => item.key).sort()).toEqual(["automation-safety", "platform-api"]);
  });
});

describe("DashboardTopNav 컴포넌트 (정적 소스 검사)", () => {
  it("항상 보이는 요소는 자동 테마 찾기 링크 + 기사 목록 링크(sm 이상) + 메뉴 트리거뿐이다", () => {
    expect(componentSource).toContain('href="/trends"');
    expect(componentSource).toContain("자동 테마 찾기");
    expect(componentSource).toMatch(/href="\/articles"[\s\S]{0,200}sm:inline-flex/);
  });

  it("PRODUCT-01C: 드롭다운 트리거 라벨이 '대시보드'가 아니라 '메뉴'다(별도 화면 이동으로 오해하지 않게, desktop/mobile 동일)", () => {
    expect(componentSource).toContain("메뉴 ▾");
    expect(componentSource).not.toContain(">대시보드<");
    // desktop 전용/mobile 전용으로 분기하던 sm:inline / sm:hidden 텍스트 분리도 제거되었다.
    expect(componentSource).not.toMatch(/hidden sm:inline">대시보드/);
  });

  it("드롭다운 트리거에 aria-haspopup/aria-expanded/aria-controls를 적용한다", () => {
    expect(componentSource).toContain('aria-haspopup="menu"');
    expect(componentSource).toContain("aria-expanded={open}");
    expect(componentSource).toContain('aria-controls="dashboard-top-nav-menu"');
  });

  it("Escape 키와 바깥 클릭으로 메뉴가 닫힌다", () => {
    expect(componentSource).toMatch(/event\.key === "Escape"/);
    expect(componentSource).toContain("containerRef.current && !containerRef.current.contains(event.target as Node)");
  });

  it("자동화 안전은 상단에서 빨간 버튼으로 항상 노출되지 않고, 메뉴 안에서만 옅은 색으로 구분된다", () => {
    expect(componentSource).not.toMatch(/bg-red-50.*px-3 py-1\.5/); // 예전처럼 상단 강한 빨간 버튼이 없다
    expect(componentSource).toMatch(/item\.danger[\s\S]{0,40}text-red-700 hover:bg-red-50/);
  });

  it("active 항목은 aria-current와 강조 스타일을 갖는다", () => {
    expect(componentSource).toContain('aria-current={active === "trends" ? "page" : undefined}');
    expect(componentSource).toContain('aria-current={isActive ? "page" : undefined}');
    expect(componentSource).toContain("bg-zinc-100 font-semibold text-zinc-900");
  });

  it("PRODUCT-01B: 관리자 그룹 앞에 구분선과 안내 문구가 있다(일반 사용자 메뉴와 같은 무게로 보이지 않게)", () => {
    expect(componentSource).toContain("border-t border-zinc-200");
    expect(componentSource).toContain("운영자/관리자 전용 화면");
  });

  it("새 UI 라이브러리를 추가하지 않고 순수 React(useState/useRef/useEffect)만 사용한다", () => {
    expect(componentSource).toMatch(/from "react"/);
    expect(componentSource).not.toMatch(/@radix-ui|headlessui|@headlessui/);
  });
});
