// Phase 3-27: "관련 기사 URL 수집" 버튼 클릭 후 무반응 문제를 고치기 위한
// page.tsx 변경을 정적 소스 검사로 고정한다.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const pageSource = readFileSync(path.join(__dirname, "page.tsx"), "utf8");

describe("수집 버튼 loading/무반응 방지 (Phase 3-27)", () => {
  it("PendingSubmitButton으로 수집 버튼을 감싸 제출 중 상태를 표시한다", () => {
    expect(pageSource).toContain('import { PendingSubmitButton } from "@/components/ui/pending-submit-button"');
    expect(pageSource).toContain("<PendingSubmitButton");
    expect(pageSource).toContain("관련 기사 URL을 수집하고 있습니다...");
  });

  it("수집 버튼은 top-level form action(FormData)이다 — 결과를 버리는 inline closure가 아니다", () => {
    expect(pageSource).toContain('<form id="collect-form" action={collectCandidates}');
    expect(pageSource).not.toMatch(/action=\{async \(\) => \{\s*"use server";\s*await collectCandidates\(themeId\);/);
  });
});

describe("수집 결과 요약 카드 (Phase 3-27)", () => {
  it("RelatedUrlCollectionResultCard를 렌더링하고 필요한 props를 전달한다", () => {
    expect(pageSource).toContain(
      'import {\n  RelatedUrlCollectionResultCard,\n  type CollectionResultStatus,\n} from "@/components/sources/related-url-collection-result-card"'
    );
    expect(pageSource).toContain("<RelatedUrlCollectionResultCard");
    expect(pageSource).toContain("status={resolvedCollectStatus}");
    expect(pageSource).toContain("newCount={");
    expect(pageSource).toContain("duplicateCount={");
    expect(pageSource).toContain("sourceStatus={sourceStatus}");
  });

  it("collectStatus searchParam이 유효한 값일 때만 결과 카드를 보여준다(임의 값 주입 방지)", () => {
    expect(pageSource).toContain("VALID_COLLECT_STATUSES");
    expect(pageSource).toContain("resolvedCollectStatus &&");
  });

  it("현재 출처 상태(summarizeSourceStatus)를 계산해 결과 카드에 넘긴다", () => {
    expect(pageSource).toContain('import { getSourcesByThemeId } from "@/lib/repositories/source-repository"');
    expect(pageSource).toContain('import { summarizeSourceStatus } from "@/lib/dashboard/source-display"');
    expect(pageSource).toContain("summarizeSourceStatus(sources, MIN_SOURCE_COUNT)");
  });

  it("다음 행동 action(추가 수집/종료/대시보드/글 생성)을 모두 결과 카드에 전달한다", () => {
    expect(pageSource).toContain("collectMoreAction={collectCandidates}");
    expect(pageSource).toContain("finishCollectionAction={finishUrlCollection}");
    expect(pageSource).toContain("goDashboardAction={goDashboardFromUrlCollection}");
    expect(pageSource).toContain("goGenerateAction={goGenerateFromUrlCollection}");
  });
});

describe("수집한 URL 확인 / 직접 URL 추가 연결 (Phase 3-27)", () => {
  it("후보 목록 섹션에 id=candidate-list가 있어 결과 카드의 링크가 이동할 수 있다", () => {
    expect(pageSource).toContain('id="candidate-list"');
  });

  it("후보가 없을 때는 수집한 URL 확인 버튼을 보여주지 않도록 hasCollectedCandidates를 전달한다", () => {
    expect(pageSource).toContain("hasCollectedCandidates={candidates.length > 0}");
  });
});

describe("raw JSON/API 응답 미노출 (Phase 3-27)", () => {
  it("전체 후보 배열이나 API 원본 응답을 그대로 렌더링하지 않는다", () => {
    expect(pageSource).not.toMatch(/\{JSON\.stringify\(candidates/);
    expect(pageSource).not.toContain("rawContent");
  });
});
