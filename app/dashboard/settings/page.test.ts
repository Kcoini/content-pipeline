import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const pageSource = readFileSync(path.join(__dirname, "page.tsx"), "utf8");

describe("PRODUCT-01D: /dashboard/settings (정적 소스 검사)", () => {
  it("기존 readiness helper(getContentServiceReadiness)를 재사용한다 — 새 판단 로직을 만들지 않는다", () => {
    expect(pageSource).toContain("getContentServiceReadiness");
    expect(pageSource).toContain("@/lib/ui/content-service-readiness");
  });

  it("연결 상태/검토 및 게시/콘텐츠 설정 3개 section을 포함한다", () => {
    expect(pageSource).toContain("콘텐츠 설정");
    expect(pageSource).toContain("연결 상태");
    expect(pageSource).toContain("검토 및 게시");
  });

  it("WordPress는 Draft 전용이라는 문구를 명시한다(공개 게시와 혼동 방지)", () => {
    expect(pageSource).toContain("항상 초안(Draft)으로 저장");
    expect(pageSource).not.toContain("공개 게시하기");
  });

  it("출처 확인/최종 승인 안전 항목에 OFF toggle을 제공하지 않는다(항상 '사용 중'만 표시)", () => {
    expect(pageSource).not.toMatch(/type="checkbox"[\s\S]{0,80}(출처 확인|최종 확인)/);
    expect(pageSource).toContain('label="출처 확인" status="available" message="사용 중"');
    expect(pageSource).toContain('label="게시 전 최종 확인" status="available" message="사용 중"');
  });

  it("연결 정보를 직접 바꿀 수 있는 것처럼 보이는 가짜 버튼(연결하기/수정하기)이 없다", () => {
    expect(pageSource).not.toContain(">연결하기<");
    expect(pageSource).not.toContain(">수정하기<");
    expect(pageSource).toContain("관리자에게 연결 설정을 요청해 주세요");
  });

  it("기술 용어(env var/provider/Supabase/Anthropic/Vercel/JSON/token)가 렌더링 텍스트(코드 주석 제외)에 없다", () => {
    // 파일 상단 주석에는 "이런 용어를 노출하지 않는다"는 설명으로
    // 이 단어들이 등장한다 — 실제 JSX 렌더링 부분(export default 이후)만 검사한다.
    const renderedPart = pageSource.slice(pageSource.indexOf("export default function"));
    const forbidden = ["WORDPRESS_BASE_URL", "WORDPRESS_PUBLISH_ENABLED", "Supabase", "Anthropic", "Vercel", "provider", "JSON.stringify", "token"];
    for (const term of forbidden) {
      expect(renderedPart).not.toContain(term);
    }
  });

  it("저장되지 않고 새로고침하면 사라지는 local-state-only 설정 UI가 없다(useState 기반 입력 없음)", () => {
    expect(pageSource).not.toContain("useState");
    expect(pageSource).not.toContain('type="text"');
    expect(pageSource).not.toContain("<form");
  });

  it("콘텐츠 기본값이 저장되지 않는다는 사실을 정직하게 안내한다(가짜 편집 UI 대신)", () => {
    expect(pageSource).toContain("저장된 기본값은 아직 없습니다");
  });

  it("상단 navigation을 그대로 재사용한다(DashboardTopNav, active='settings')", () => {
    expect(pageSource).toContain("DashboardTopNav");
    expect(pageSource).toContain('active="settings"');
  });

  it("콘텐츠 만들기로 돌아가는 링크가 있다(dead-end 없음)", () => {
    expect(pageSource).toContain('href="/dashboard"');
  });
});
