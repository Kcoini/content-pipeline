// Phase UX-06: 프로젝트 전체에서 raw DB 상태값/필드명/env 변수명/기술
// 용어가 "사용자에게 보이는 텍스트"로 노출되지 않는지 자동으로
// 검사한다(docs/ui-ux-governance-rules.md 섹션 "페이지 간 일관성 원칙"
// 1번을 정적 검사로 고정). 새 검사 기법을 발명하지 않는다 — 이미
// 각 페이지 .test.ts가 쓰는 readFileSync + regex 패턴을 여러 파일에
// 걸쳐 반복 적용할 뿐이다.
//
// 코드 주석/타입 선언/변수명/문자열 비교(=== "not_checked")는 허용한다
// — JSX 텍스트 콘텐츠(>...</) 또는 라벨/타이틀 문자열 리터럴 안에
// 그대로 등장하는 경우만 위반으로 본다.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(__dirname, "..", "..");

// Phase UX-06 section 11의 4개 재확인 대상 + 이미 여러 phase에서 검증된
// 핵심 사용자 페이지 + 공유 UI 컴포넌트 라이브러리를 함께 스캔한다.
const SCAN_TARGETS = [
  "app/articles/[id]/social/page.tsx",
  "app/articles/[id]/blog/page.tsx",
  "app/social-posts/[id]/page.tsx",
  "app/articles/[id]/rewrite/page.tsx",
  "app/articles/[id]/page.tsx",
  "app/dashboard/page.tsx",
  "app/dashboard/blog/page.tsx",
  "app/dashboard/rewrite/page.tsx",
  "app/dashboard/social-performance/page.tsx",
  "app/trends/page.tsx",
  "app/themes/[themeId]/page.tsx",
  "components/review/auto-review-summary-card.tsx",
  "components/review/human-review-panel.tsx",
  "components/review/multi-platform-review-summary-card.tsx",
  "components/publish/publish-preparation-summary-card.tsx",
  "components/publish/platform-publish-preparation-card.tsx",
  "components/workflow/next-action-panel.tsx",
  "components/workflow/workflow-status-card.tsx",
  "components/wordpress/wordpress-publishing-panel.tsx",
];

function readSource(relPath: string): string {
  return readFileSync(path.join(ROOT, relPath), "utf8").replace(/\r\n/g, "\n");
}

/**
 * app/articles/[id]/page.tsx는 이미 문서화된 예외다(docs/ux/full-ux-audit.md
 * H5, "부분 해결" — UX-02A가 만든 "⚠ 관리자 전용" 이중 접힘 안에서만
 * env 변수 이름/dry-run 안내가 남아 있고, 재구조화는 회귀 위험이 커
 * 의도적으로 보류됨). 그 접힘 시작 지점 이전만 검사 대상으로 좁힌다 —
 * 접힘 밖(일반 사용자가 기본으로 보는 영역)에는 이런 문구가 없어야
 * 한다는 원칙은 그대로 지킨다.
 */
function scopeToBeforeAdminSection(relPath: string, source: string): string {
  if (relPath !== "app/articles/[id]/page.tsx") return source;
  const adminSectionStart = source.indexOf("관리자 기능: 원본 article WordPress 전송");
  return adminSectionStart === -1 ? source : source.slice(0, adminSectionStart);
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

/** JSX 텍스트 콘텐츠(>...raw...<) 또는 문자열 리터럴로 쓰인 label/title 값 안에 candidate가 그대로 등장하는지 확인한다. */
function appearsAsUserFacingText(source: string, candidate: string): boolean {
  const clean = stripComments(source);
  const patterns = [
    new RegExp(`>[^<{\\n]*${candidate}[^<{\\n]*<`), // JSX 텍스트 자식(같은 줄 안에서만 — 여러 줄에 걸친 무관한 >...< 오탐 방지)
    new RegExp(`(label|title)\\s*[:=]\\s*["'\`][^"'\`\\n]*${candidate}`), // label="..." / title: "..."
  ];
  return patterns.some((re) => re.test(clean));
}

describe("Raw 기술 정보 노출 검사 (Phase UX-06)", () => {
  const RAW_STATUS_FIELD_NAMES = [
    "quality_status",
    "approval_status",
    "publish_status",
    "export_status",
    "manual_post_status",
    "suggestion_status",
    "rewrite_reapproval_status",
    "publish_guard",
  ];

  for (const relPath of SCAN_TARGETS) {
    it(`${relPath}: raw DB 필드명이 사용자 텍스트로 노출되지 않는다`, () => {
      const source = readSource(relPath);
      for (const field of RAW_STATUS_FIELD_NAMES) {
        expect(appearsAsUserFacingText(source, field), `${relPath}에서 "${field}"가 사용자 텍스트로 노출됨`).toBe(false);
      }
    });

    it(`${relPath}: raw enum 값이 사용자 텍스트로 노출되지 않는다`, () => {
      const source = readSource(relPath);
      for (const value of ["not_checked", "needs_revision", "not_attached"]) {
        expect(appearsAsUserFacingText(source, value), `${relPath}에서 "${value}"가 사용자 텍스트로 노출됨`).toBe(false);
      }
    });

    it(`${relPath}: env 변수명이 사용자 텍스트로 노출되지 않는다(관리자 전용 접힘 안은 문서화된 예외)`, () => {
      const source = scopeToBeforeAdminSection(relPath, readSource(relPath));
      for (const prefix of ["WORDPRESS_", "SEO_PLUGIN_", "ARTICLE_SEARCH_ENABLED"]) {
        expect(appearsAsUserFacingText(source, prefix), `${relPath}에서 env 변수명 "${prefix}"가 사용자 텍스트로 노출됨`).toBe(false);
      }
    });

    it(`${relPath}: 'dry-run'/영문 'handoff'가 사용자 텍스트로 노출되지 않는다(관리자 전용 접힘 안은 문서화된 예외)`, () => {
      const source = scopeToBeforeAdminSection(relPath, stripComments(readSource(relPath)));
      // "dry-run"은 대소문자 무관하게 JSX 텍스트에 없어야 한다(한국어 설명으로 이미 번역됨, UX-04B/05B 참고). 같은 줄 안에서만 매칭(여러 줄에 걸친 무관한 >...< 오탐 방지).
      expect(source).not.toMatch(/>[^<{\n]*[Dd]ry-run[^<{\n]*</);
      // "handoff"는 이미 "수동 게시 준비"로 번역되어 있어야 한다(UX-03B1) —
      // describeStatusField("handoff_status") 같은 내부 필드명 인자는 허용한다.
      expect(source).not.toMatch(/>[^<{\n]*[Hh]andoff[^<{\n]*</);
    });
  }
});
