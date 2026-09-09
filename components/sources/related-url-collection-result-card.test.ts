// Phase 3-27: 이 프로젝트는 컴포넌트를 렌더링하는 테스트 라이브러리를
// 쓰지 않고, 정적 소스 검사(readFileSync)로 UI 구조/문구를 고정하는
// 관례를 따른다(`app/**/page.test.ts` 참고). 이 파일도 같은 방식이다.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const source = readFileSync(path.join(__dirname, "related-url-collection-result-card.tsx"), "utf8");

describe("상태별 메시지 (Phase 3-27)", () => {
  it("성공/부분성공/결과없음/실패/종료 5가지 상태 문구를 모두 정의한다", () => {
    expect(source).toContain("관련 기사 URL 수집이 완료되었습니다.");
    expect(source).toContain("일부 기사 URL만 수집되었습니다.");
    expect(source).toContain("새로 등록할 기사 URL을 찾지 못했습니다.");
    expect(source).toContain("관련 기사 URL 수집 중 오류가 발생했습니다.");
    expect(source).toContain("출처 수집을 종료했습니다.");
  });

  it("실패 상태에서만 오류 메시지를 보여준다", () => {
    expect(source).toContain('status === "error" && errorMessage');
  });
});

describe("결과 요약 숫자 (Phase 3-27)", () => {
  it("새로 찾은 기사/이미 알고 있던 기사/등록된 기사/제외된 기사 개수를 보여준다", () => {
    expect(source).toContain("새로 찾은 기사");
    expect(source).toContain("이미 알고 있던 기사");
    expect(source).toContain("등록된 기사(누적)");
    expect(source).toContain("제외된 기사(누적)");
  });

  it("현재 출처 상태(등록/본문수집/요약)를 보여준다", () => {
    expect(source).toContain("현재 출처");
    expect(source).toContain("sourceStatus.fetchSuccessCount");
    expect(source).toContain("sourceStatus.summarySuccessCount");
  });
});

describe("다음 행동 버튼 (Phase 3-27)", () => {
  it("추가 수집/이 정도로 충분합니다/글 생성 단계로 진행/수집한 URL 확인/직접 URL 추가/대시보드로 돌아가기 버튼이 모두 있다", () => {
    expect(source).toContain("추가로 기사 URL 수집");
    expect(source).toContain("이 정도로 충분합니다");
    expect(source).toContain("글 생성 단계로 진행");
    expect(source).toContain("수집한 URL 확인");
    expect(source).toContain("직접 URL 추가");
    expect(source).toContain("대시보드로 돌아가기");
  });

  it("종료 상태(finished)에서는 추가 수집/종료 확인 블록을 보여주지 않는다", () => {
    expect(source).toMatch(/status !== "finished" && \(\s*<div className="mt-3 rounded border border-white\/60 bg-white\/50 p-2 text-xs">\s*<p className="font-medium">더 많은 관련 기사를 찾아볼까요\?/);
  });

  it("출처가 충분하면 글 생성 단계로 진행이, 부족하면 추가 수집이 primary action이다", () => {
    expect(source).toContain('if (sourceStatus.isReady) return "generate";');
    expect(source).toContain('return "collect_more";');
  });

  it("결과가 없고 새로 찾은 게 없으면 직접 URL 추가가 primary action이다", () => {
    expect(source).toContain('if (status === "none" && newCount === 0) return "add_manual";');
  });

  it("모든 다음 행동 버튼은 PendingSubmitButton 또는 Link로 무반응 없이 반응한다", () => {
    expect(source).toContain('import { PendingSubmitButton } from "@/components/ui/pending-submit-button"');
    const submitButtonCount = (source.match(/<PendingSubmitButton/g) ?? []).length;
    expect(submitButtonCount).toBeGreaterThanOrEqual(3);
  });
});

describe("raw 데이터 미노출 (Phase 3-27)", () => {
  it("raw JSON/API 응답 전체를 렌더링하지 않는다(숫자 요약과 문구만 사용한다)", () => {
    expect(source).not.toContain("JSON.stringify");
    expect(source).not.toContain("rawContent");
    expect(source).not.toMatch(/\{status\}/); // raw status 문자열을 그대로 화면에 꽂지 않는다(STATUS_HEADLINE을 거친다)
  });
});
