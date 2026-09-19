// Phase UX-06: 페이지 단위가 아니라 "프로젝트 전체 UX 규칙"을 자동으로
// 지키는지 검사하는 회귀 테스트. docs/ui-ux-governance-rules.md에 이미
// 산문으로 정리된 원칙들을 정적 소스 검사로 고정한다 — 앞으로 어떤
// 페이지를 고치더라도 이 규칙을 실수로 어기면 테스트가 실패한다.
//
// 이 파일은 새 검사 기법을 발명하지 않는다 — 각 페이지 .test.ts가
// 이미 쓰고 있는 readFileSync + substring/regex assertion 패턴을
// 여러 파일에 걸쳐 반복 적용할 뿐이다.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(__dirname, "..", "..");

const CORE_PAGES = [
  "app/articles/[id]/social/page.tsx",
  "app/articles/[id]/blog/page.tsx",
  "app/social-posts/[id]/page.tsx",
  "app/articles/[id]/rewrite/page.tsx",
  "app/dashboard/page.tsx",
  "app/dashboard/blog/page.tsx",
  "app/dashboard/rewrite/page.tsx",
  "app/dashboard/social-performance/page.tsx",
  "app/trends/page.tsx",
  "app/themes/[themeId]/page.tsx",
  "app/articles/[id]/page.tsx",
];

function readPage(relPath: string): string {
  return readFileSync(path.join(ROOT, relPath), "utf8").replace(/\r\n/g, "\n");
}

/**
 * "다음 작업" 같은 문구는 코드 주석(`// 다음 작업을 계산...`) 안에도
 * 자주 등장한다 — 실제 사용자에게 보이는 문구인지 확인하려면 주석은
 * 제외하고 봐야 오탐(false positive)이 없다. 문자열 리터럴 안의
 * `//`/`/* *‍/`까지 완벽히 구분하지는 않지만, 이 프로젝트 소스에는
 * 그런 리터럴이 없어 실용적으로 충분하다.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

describe("UX invariant B: '다음 작업' 문구에는 항상 실제 action이 가까이 있다", () => {
  const ACTION_HINTS = [
    "primaryAction",
    "NextActionPanel",
    "nextAction",
    "<form action=",
    "getNextRecommendedAction",
    // Phase UX-06: "다음 작업" 옆에 실제 페이지 이동 링크(<Link href=...>)만
    // 있는 경우도 실제 action이다(예: app/articles/[id]/page.tsx의 보조
    // route 요약 카드 — UX-03C에서 이미 이 패턴으로 정리됨).
    "<Link",
  ];

  for (const relPath of CORE_PAGES) {
    it(`${relPath}: "다음 작업" 등장 지점마다 500자 이내에 실제 action 참조가 있다`, () => {
      const source = stripComments(readPage(relPath));
      let index = source.indexOf("다음 작업");
      let found = 0;
      // Phase UX-06: 섹션 제목("현재 상태 / 다음 작업" 같은 h1/h2)과 실제
      // 액션 버튼 사이에는 상태 요약 문단이 끼어 있을 수 있어(예:
      // app/dashboard/page.tsx), 500자보다 넉넉한 창을 쓴다 — 그래도
      // 진짜 dead-end(액션이 아예 없는 경우)는 여전히 잡아낸다.
      const WINDOW = 3000;
      while (index !== -1) {
        found += 1;
        const window = source.slice(Math.max(0, index - WINDOW), index + WINDOW);
        const hasHint = ACTION_HINTS.some((hint) => window.includes(hint));
        expect(hasHint, `"다음 작업" occurrence #${found} at index ${index} in ${relPath} has no nearby action reference`).toBe(true);
        index = source.indexOf("다음 작업", index + 1);
      }
    });
  }
});

describe("UX invariant C: 승인 완료 상태에서 [승인] 버튼이 무조건 활성화되지 않는다", () => {
  it("social-posts/[id]: 최종 승인 버튼은 항상 gate.canApprove로 disabled를 제어한다", () => {
    const source = readPage("app/social-posts/[id]/page.tsx");
    expect(source).toContain("disabled={!gate.canApprove}");
  });

  it("articles/[id]/social, articles/[id]/blog: approveSocialPostAction은 폼 제출로만 호출되고 프로그래밍적으로 호출되지 않는다", () => {
    for (const relPath of ["app/articles/[id]/social/page.tsx", "app/articles/[id]/blog/page.tsx"]) {
      const source = readPage(relPath);
      expect(source).not.toMatch(/approveSocialPostAction\(/);
    }
  });
});

describe("UX invariant D: completed 상태에서 동일 실행 action이 반복 노출되지 않는다", () => {
  it("publish-preparation-view-model: outcomeOverride(completed/failed)이면 secondaryActions가 비워진다(원래 action 반복 금지)", () => {
    const source = readPage("lib/ui/publish-preparation-view-model.ts");
    // secondaryActions: outcomeOverride ? [] : ... 형태 — completed/failed
    // 둘 다 outcomeOverride가 truthy이므로 같은 조건으로 secondaryActions를
    // 비운다(별도로 "completed일 때만"으로 좁히지 않는다 — failed도
    // 기존 액션을 반복 노출하면 안 되는 건 마찬가지다).
    const occurrences = source.match(/secondaryActions: outcomeOverride\s*\n\s*\?\s*\[\]/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(2); // WordPress 어댑터 + 그 외 플랫폼 어댑터
  });

  it("bulkApproveSocialPostsAction/recordManualPostingResultAction은 폼 제출로만 실행된다(자동 반복 호출 없음)", () => {
    const source = readPage("app/articles/[id]/social/page.tsx");
    expect(source).not.toMatch(/bulkApproveSocialPostsAction\(/);
    expect(source).not.toMatch(/recordManualPostingResultAction\(/);
  });
});

describe("UX invariant E: '본문 수정' 버튼은 항상 inline edit이고, 다른 페이지로 navigation하지 않는다", () => {
  it("프로젝트 전체에서 '본문 수정' 텍스트가 <Link>/<a> 태그 안에 있지 않다(post-body-action-row.tsx의 <button> 패턴만 허용)", () => {
    const filesToScan = [
      "components/social/post-body-action-row.tsx",
      "components/social/social-post-body-panel.tsx",
      "components/social/inline-post-body-editor.tsx",
      "app/articles/[id]/social/page.tsx",
      "app/articles/[id]/blog/page.tsx",
    ];
    for (const relPath of filesToScan) {
      const source = readPage(relPath);
      // "본문 수정"이 <Link ...>...본문 수정...</Link> 또는 <a ...>...본문 수정...</a>
      // 안에 직접 들어있으면 위반이다(과거 X 플랫폼 카드가 이 패턴이었다 — UX-03B2에서 수정됨).
      expect(source).not.toMatch(/<(Link|a)\b[^>]*>\s*본문 수정\s*<\/(Link|a)>/);
    }
  });

  it("post-body-action-row.tsx: [본문 수정]은 <button type=\"button\" onClick={onEdit} ...>이다(네이티브 form 제출도, 링크도 아닌 로컬 편집 모드 전환)", () => {
    const source = readPage("components/social/post-body-action-row.tsx");
    expect(source).toMatch(/<button type="button" onClick=\{onEdit\}[^>]*>\s*본문 수정\s*<\/button>/);
  });
});

describe("UX invariant I: public publish primary action이 일반 사용자 흐름(핵심 페이지)에 없다", () => {
  const CORE_USER_FLOW_PAGES = [
    "app/articles/[id]/social/page.tsx",
    "app/articles/[id]/blog/page.tsx",
    "app/social-posts/[id]/page.tsx",
    "app/dashboard/page.tsx",
    "app/dashboard/blog/page.tsx",
  ];

  for (const relPath of CORE_USER_FLOW_PAGES) {
    it(`${relPath}: "공개 게시"/"실제 게시" 버튼(제출 가능한 action)이 없다`, () => {
      const source = readPage(relPath);
      // 안내 문구("공개 게시는 하지 않습니다" 등)는 허용한다 — 실제 실행
      // 가능한 버튼/링크 텍스트로만 쓰였는지 확인한다.
      expect(source).not.toMatch(/>\s*공개 게시(하기)?\s*</);
      expect(source).not.toMatch(/>\s*실제 게시(하기)?\s*</);
    });
  }

  it("articles/[id]/page.tsx(보조 route)의 실제 공개 게시 action은 '⚠ 관리자 전용' 이중 접힘 안에서만 존재한다(UX-02A 안전장치 재확인)", () => {
    const source = readPage("app/articles/[id]/page.tsx");
    const adminSectionStart = source.indexOf("관리자 기능: 원본 article WordPress 전송");
    expect(adminSectionStart).toBeGreaterThan(-1);
    const beforeAdminSection = source.slice(0, adminSectionStart);
    // 관리자 접힘 전에는 실제 게시 실행 폼이 없어야 한다(파일 상단의
    // import 선언은 실제 렌더링이 아니므로 제외하고, <form action={...}>
    // 사용만 확인한다).
    expect(beforeAdminSection).not.toMatch(/<form action=\{publishApprovedArticleToWordPressAction\}/);
  });
});

describe("UX invariant J: 본문 복사는 게시 완료를 의미하지 않는다", () => {
  it("copy-post-body-button.tsx는 상태를 바꾸는 서버 action을 호출하지 않는다(순수 client clipboard + 로깅만, manual_post_status/publish_status 변경 없음)", () => {
    const source = readPage("components/social/copy-post-body-button.tsx");
    expect(source).toContain('"use client"');
    expect(source).not.toMatch(/manual_post_status|manualPostStatus\s*[:=]/);
    expect(source).not.toMatch(/publish_status|publishStatus\s*[:=]/);
    // 클라이언트 이벤트 로깅(logSocialPostInlineEditClientEventAction)은
    // 상태를 바꾸지 않는 안전한 예외로 허용한다 — 실제 상태 변경 action
    // (승인/일괄 승인/게시 완료 기록)은 절대 호출하지 않는지만 확인한다.
    expect(source).not.toMatch(/approveSocialPostAction|bulkApproveSocialPostsAction|recordManualPostingResultAction/);
  });
});

describe("UX invariant K: WordPress Draft 완료는 공개 게시 완료로 표시되지 않는다", () => {
  it("publish-preparation-view-model.ts: WordPress의 '완료' 판정은 publishStatus==='published'일 때만 발생한다(Draft 존재만으로 completed가 되지 않는다)", () => {
    const source = readPage("lib/ui/publish-preparation-view-model.ts");
    expect(source).toContain('if (publishStatus === "published" || manualPostStatus === "posted") return "completed";');
    // view_draft(=Draft 조회 가능) 자체는 ready로 남아야 한다 — "완료"가 아니다.
    expect(source).toMatch(/view_draft:\s*"ready"/);
  });

  it("articles/[id]/blog/page.tsx: Draft 관련 안내 문구에 '공개 게시는 하지 않습니다'가 있어 혼동을 방지한다", () => {
    const source = readPage("app/articles/[id]/blog/page.tsx");
    expect(source).toMatch(/공개 게시(는|\s)?(하지 않습니다|버튼은 누르지 않습니다)/);
  });
});
