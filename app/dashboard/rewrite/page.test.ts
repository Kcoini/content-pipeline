import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const pageSource = readFileSync(path.join(__dirname, "page.tsx"), "utf8");

describe("rewrite dashboard page 한국어 제목/라벨 (정적 소스 검사, Phase 3-24)", () => {
  it("h1 제목이 한국어다(영어 'Rewrite Dashboard'가 아니다)", () => {
    expect(pageSource).not.toContain("Rewrite Dashboard");
    expect(pageSource).toMatch(/<h1 className="text-2xl font-bold">재작성 관리<\/h1>/);
  });

  it("이 화면에서 할 수 있는 일을 한 문장으로 안내한다", () => {
    expect(pageSource).toContain("성과가 낮거나 개선이 필요한 글의 재작성 제안과 버전을 관리합니다.");
  });

  it("영어 섹션 제목(Rewrite Versions)이 한국어로 바뀐다", () => {
    expect(pageSource).not.toContain("Rewrite Versions (");
    expect(pageSource).toContain("재작성 버전 (");
  });

  it("필터 select와 테이블은 raw enum이 아니라 라벨을 표시한다", () => {
    expect(pageSource).toContain("{PLATFORM_LABELS[p]}");
    expect(pageSource).toContain("describeStatusValue(p.versionComparisonStatus)");
  });
});

describe("Phase 4-26: 대시보드 재작성 테이블에도 본문 확인/수정/복사를 붙인다 (정적 소스 검사)", () => {
  it("SocialPostBodyPanel을 <details>(기본 접힘)로 감싸 표 레이아웃을 해치지 않는다", () => {
    expect(pageSource).toContain('from "@/components/social/social-post-body-panel"');
    expect(pageSource).toContain("<details");
    expect(pageSource).toContain("<SocialPostBodyPanel");
    expect(pageSource).toContain("getSocialPostDisplayBody(p)");
    expect(pageSource).toContain("platform={p.platform}");
  });

  it("저장 action은 현재 필터를 유지한 채 이 대시보드 페이지로 돌아온다", () => {
    expect(pageSource).toContain('"/dashboard/rewrite"');
    expect(pageSource).toContain("returnTo={returnTo}");
  });
});

describe("Phase UX-03C: dashboard/rewrite 용어를 detail page(/articles/[id]/rewrite)와 통일한다", () => {
  it("테이블 헤더가 옛 '재승인' 단독 표현 대신 '재검토/최종 승인'을 쓴다", () => {
    expect(pageSource).not.toContain(">재승인/재내보내기<");
    expect(pageSource).toContain("재검토/최종 승인 · 재내보내기");
  });

  it("rewrite_reapproval_status 필터 라벨도 공용 describeStatusField를 거치므로 이 값이 바뀌면 이 페이지에도 자동 반영된다(페이지 자체에서 중복 하드코딩하지 않는다)", () => {
    expect(pageSource).toContain('describeStatusField("rewrite_reapproval_status")');
    expect(pageSource).not.toMatch(/>재승인 상태</);
  });
});
