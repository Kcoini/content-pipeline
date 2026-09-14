import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const pageSource = readFileSync(path.join(__dirname, "page.tsx"), "utf8");

describe("blog dashboard page 한국어 제목/라벨 (정적 소스 검사, Phase 3-24)", () => {
  it("h1 제목이 한국어다(영어 'Blog Dashboard'가 아니다)", () => {
    expect(pageSource).not.toContain("Blog Dashboard");
    expect(pageSource).toMatch(/<h1 className="text-2xl font-bold">블로그 현황<\/h1>/);
  });

  it("이 화면에서 할 수 있는 일을 한 문장으로 안내한다", () => {
    expect(pageSource).toContain("WordPress와 네이버 블로그 글의 생성, 검토, 게시 준비 상태를 확인합니다.");
  });

  it("필터 select와 테이블은 raw enum이 아니라 PLATFORM_LABELS/describeStatusValue로 표시한다", () => {
    expect(pageSource).toContain('import { PLATFORM_LABELS } from "@/lib/social/platform-generation-recommendations"');
    expect(pageSource).toContain('import { describeStatusValue, describeStatusField } from "@/lib/social/status-labels"');
    expect(pageSource).toContain("{PLATFORM_LABELS[p]}");
    expect(pageSource).toContain("describeStatusValue(p.qualityStatus)");
  });

  it("영어 섹션 제목(Blog Posts)이 한국어로 바뀐다", () => {
    expect(pageSource).not.toContain("Blog Posts (");
    expect(pageSource).toContain("블로그 글 목록 (");
  });
});

describe("Phase 4-26: 대시보드 블로그 테이블에도 본문 확인/수정/복사를 붙인다 (정적 소스 검사)", () => {
  it("SocialPostBodyPanel을 <details>(기본 접힘)로 감싸 표 레이아웃을 해치지 않는다", () => {
    expect(pageSource).toContain('from "@/components/social/social-post-body-panel"');
    expect(pageSource).toContain("<details");
    expect(pageSource).toContain("<SocialPostBodyPanel");
    expect(pageSource).toContain("getSocialPostDisplayBody(p)");
    expect(pageSource).toContain("platform={p.platform}");
  });

  it("본문이 없으면 <details>를 렌더링하지 않는다", () => {
    expect(pageSource).toContain("if (!displayBody) return null;");
  });

  it("저장 action은 현재 필터를 유지한 채 이 대시보드 페이지로 돌아온다", () => {
    expect(pageSource).toContain('"/dashboard/blog"');
    expect(pageSource).toContain("returnTo={returnTo}");
  });
});
