import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const pageSource = readFileSync(path.join(__dirname, "page.tsx"), "utf8");
const actionsSource = readFileSync(path.join(__dirname, "actions.ts"), "utf8");
// Phase 1-23: 테마 목록/검색/삭제 UI는 좌측 사이드바 컴포넌트로 옮겨졌다.
const themeSearchListSource = readFileSync(
  path.join(__dirname, "..", "..", "components", "dashboard", "theme-search-list.tsx"),
  "utf8"
);

describe("dashboard 테마 목록 삭제(보관 처리) 버튼 (정적 소스 검사)", () => {
  it("테마 목록에 삭제 버튼(archiveThemeAction)이 있다", () => {
    expect(pageSource).toContain("archiveThemeAction");
    expect(themeSearchListSource).toContain("ConfirmSubmitButton");
    expect(themeSearchListSource).toContain("삭제");
  });

  it("삭제 확인 모달 문구에 연결된 기사/출처 개수와 WordPress 안내가 포함된다", () => {
    expect(themeSearchListSource).toContain("이 테마를 삭제하시겠습니까?");
    expect(themeSearchListSource).toMatch(/연결된 기사 \$\{articleCount\}개, 출처 \$\{sourceCount\}개/);
    expect(themeSearchListSource).toContain("이미 생성된 WordPress 글은 자동 삭제되지 않습니다.");
  });

  it("삭제/에러 메시지를 TransientNotice로 표시한다", () => {
    expect(pageSource).toContain("TransientNotice");
    expect(pageSource).toContain("deleteMessage");
    expect(pageSource).toContain("deleteError");
  });

  it("actions.ts는 hard delete가 아니라 archiveTheme(soft delete)만 호출한다", () => {
    expect(actionsSource).toContain("archiveTheme(themeId)");
    expect(actionsSource).not.toMatch(/\.delete\(\)/);
  });

  it("이미 보관된 테마는 theme_delete_blocked로 기록하고, 성공 시 theme_archived로 기록한다", () => {
    expect(actionsSource).toContain("theme_delete_blocked");
    expect(actionsSource).toContain("theme_archived");
  });

  it("삭제 전 연관 데이터(getThemeRelatedCounts)를 조회한다", () => {
    expect(actionsSource).toContain("getThemeRelatedCounts(themeId)");
  });
});

describe("dashboard 상단 내비게이션 단순화 (정적 소스 검사, Phase 1-22)", () => {
  it("헤더는 DashboardTopNav 컴포넌트로 대체되고, 예전처럼 버튼 8개를 나열하지 않는다", () => {
    expect(pageSource).toContain('import { DashboardTopNav } from "@/components/navigation/dashboard-top-nav"');
    expect(pageSource).toContain("<DashboardTopNav active={null} />");
  });

  it("예전 영문 버튼명(Content/Blog/Rewrite/Social Performance/Platform API Readiness/Automation Safety Dashboard)이 페이지에 직접 나열되지 않는다", () => {
    expect(pageSource).not.toContain("Content Dashboard");
    expect(pageSource).not.toContain("Blog Dashboard");
    expect(pageSource).not.toContain("Rewrite Dashboard");
    expect(pageSource).not.toContain("Social Performance Dashboard");
    expect(pageSource).not.toContain("Platform API Readiness");
    expect(pageSource).not.toContain("Automation Safety");
  });

  it("자동 테마 찾기 라우트(/trends)는 여전히 존재한다(라우팅 기능 유지)", () => {
    expect(pageSource).toContain("자동 테마 찾기");
  });
});

describe("dashboard 선택한 테마 중심 작업형 대시보드 개편 (정적 소스 검사, Phase 1-23)", () => {
  it("새 테마 입력 폼은 <details>로 기본 접힘 상태다", () => {
    const match = pageSource.match(/<details className="group rounded-lg[\s\S]*?<\/summary>[\s\S]*?<form action=\{createTheme\}/);
    expect(match).not.toBeNull();
    expect(pageSource).not.toMatch(/<details[^>]*open[^>]*>[\s\S]{0,50}<summary[^>]*>[\s\S]{0,80}\+ 새 테마/);
  });

  it("테마 검색은 ThemeSearchList 컴포넌트로 분리되어 있다", () => {
    expect(pageSource).toContain('import { ThemeSearchList } from "@/components/dashboard/theme-search-list"');
    expect(pageSource).toContain("<ThemeSearchList");
    expect(themeSearchListSource).toContain('type="search"');
  });

  it("현재 선택된 테마는 ThemeSearchList에서 aria-current와 강조 스타일로 표시된다", () => {
    expect(themeSearchListSource).toContain('aria-current={isSelected ? "page" : undefined}');
    expect(themeSearchListSource).toContain("bg-zinc-900 font-medium text-white");
  });

  it("선택된 테마 요약 카드에 출처 개수/조건 충족/기사 작성 가능 여부가 표시된다", () => {
    expect(pageSource).toMatch(/출처 \{sources\.length\}개 등록됨/);
    expect(pageSource).toContain('{sourceStatus.isReady ? "조건 충족" : "출처 부족"}');
    expect(pageSource).toMatch(/기사 작성 가능/);
  });

  it("다음 작업 카드가 상태(needs_source/ready_to_generate/article_exists)에 맞는 문구와 버튼을 표시한다", () => {
    expect(pageSource).toContain('nextActionState === "article_exists"');
    expect(pageSource).toContain("이 테마로 생성된 기사가 있습니다.");
    expect(pageSource).toContain('nextActionState === "ready_to_generate"');
    expect(pageSource).toContain("출처 조건이 충족되어 기사 초안을 생성할 수 있습니다.");
    expect(pageSource).toContain('nextActionState === "needs_source"');
    expect(pageSource).toMatch(/기사 작성을 위해 출처가 \{.*\}개 더 필요합니다\./);
  });

  it("출처 상태 요약이 출처 등록 폼보다 먼저 표시된다", () => {
    const statusIndex = pageSource.indexOf("출처 {sourceStatus.total}개 등록됨");
    const formIndex = pageSource.indexOf("+ 출처 추가");
    expect(statusIndex).toBeGreaterThanOrEqual(0);
    expect(formIndex).toBeGreaterThan(statusIndex);
  });

  it("출처 등록 폼은 <details>로 기본 접힘이고, URL 외 필드는 중첩된 접기 영역(추가 정보 입력) 안에 있다", () => {
    expect(pageSource).toMatch(/<details className="group" open=\{Boolean\(sourceError\)\}>/);
    expect(pageSource).toContain("추가 정보 입력 (선택)");
    const detailMatch = pageSource.match(/추가 정보 입력 \(선택\)[\s\S]*?<\/details>/);
    expect(detailMatch).not.toBeNull();
    expect(detailMatch![0]).toContain('name="publisher"');
    expect(detailMatch![0]).toContain('name="summary"');
  });

  it("출처 목록에서 URL 전체 대신 도메인(extractDomain)을 표시한다", () => {
    expect(pageSource).toContain("extractDomain(source.url)");
    expect(pageSource).not.toMatch(/\{source\.url \|\| "\(URL 없음\)"\}/); // 예전처럼 URL 전체를 그대로 노출하지 않는다
  });

  it("출처 요약은 line-clamp-2로 제한되고, 전체 보기/본문 보기는 <details>로 분리된다", () => {
    expect(pageSource).toMatch(/line-clamp-2 break-keep text-xs leading-relaxed text-zinc-600/);
    expect(pageSource).toContain("요약 전체 보기");
    expect(pageSource).toContain("본문 보기");
  });

  it("원문 열기 링크가 새 탭으로 열린다", () => {
    expect(pageSource).toMatch(/href=\{source\.url\}[\s\S]{0,60}target="_blank"/);
  });

  it("출처 삭제 버튼은 이번 작업에 포함하지 않았다는 설명이 남아 있다(DB schema 변경 금지 원칙과의 충돌 문서화)", () => {
    expect(pageSource).toContain("삭제 기능은 이번 작업에서 추가하지 않았다");
  });

  it("테마 생성/출처 추가/기사 생성 서버 액션은 그대로 유지된다(기능 로직 변경 금지)", () => {
    expect(pageSource).toContain("action={createTheme}");
    expect(pageSource).toContain("action={addSource}");
    expect(pageSource).toContain("action={generateArticleDraft}");
  });

  it("모바일에서는 flex-col-reverse로 선택된 테마 작업 영역이 먼저, 테마 목록 사이드바가 나중에 표시된다", () => {
    expect(pageSource).toContain("flex flex-col-reverse gap-6 lg:grid lg:grid-cols-[280px_1fr]");
  });

  it("주요 텍스트(테마 제목/설명, 출처 제목)에 break-keep을 적용한다", () => {
    expect(pageSource).toMatch(/<h2 className="break-keep text-lg font-semibold">\{selectedTheme\.title\}<\/h2>/);
    expect(pageSource).toMatch(/break-keep text-sm text-zinc-600">\{selectedTheme\.description\}/);
    expect(pageSource).toMatch(/min-w-0 flex-1 break-keep font-medium/);
  });
});
