import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MultiPlatformReviewSummaryCard } from "./multi-platform-review-summary-card";
import type { MultiPlatformReviewSummary } from "@/lib/ui/multi-platform-review-summary";

function makeSummary(overrides: Partial<MultiPlatformReviewSummary> = {}): MultiPlatformReviewSummary {
  return {
    total: 6,
    checking: 0,
    ready: 5,
    needsConfirmation: 1,
    blocked: 0,
    failed: 0,
    approved: 0,
    readyPostIds: [],
    needsConfirmationPostIds: [],
    blockedPostIds: [],
    failedPostIds: [],
    checkingPostIds: [],
    approvedPostIds: [],
    bulkApprovalEligiblePostIds: [],
    ...overrides,
  };
}

describe("MultiPlatformReviewSummaryCard (Phase UX-04B)", () => {
  it("전체/확인할 사항 없음/확인 필요 개수를 사용자 문구로 보여준다", () => {
    const html = renderToStaticMarkup(<MultiPlatformReviewSummaryCard summary={makeSummary()} />);
    expect(html).toContain("전체");
    expect(html).toContain("6개");
    expect(html).toContain("확인할 사항 없음");
    expect(html).toContain("5개");
    expect(html).toContain("확인 필요");
    expect(html).toContain("1개");
  });

  it("blocked가 있으면 '게시 전 해결 필요'로 표시한다", () => {
    const html = renderToStaticMarkup(
      <MultiPlatformReviewSummaryCard summary={makeSummary({ ready: 4, blocked: 1, total: 6 })} />
    );
    expect(html).toContain("게시 전 해결 필요");
    expect(html).toContain("1개");
  });

  it("0개인 카테고리는 표시하지 않는다(카드가 지나치게 길어지지 않게)", () => {
    const html = renderToStaticMarkup(<MultiPlatformReviewSummaryCard summary={makeSummary({ blocked: 0, failed: 0, checking: 0 })} />);
    expect(html).not.toContain("게시 전 해결 필요");
    expect(html).not.toContain("자동 검토 실패");
    expect(html).not.toContain("자동 검토 중");
  });

  it("raw state 이름/approval_status를 그대로 노출하지 않는다", () => {
    const html = renderToStaticMarkup(<MultiPlatformReviewSummaryCard summary={makeSummary()} />);
    expect(html).not.toContain("ready");
    expect(html).not.toContain("needs_confirmation");
    expect(html).not.toContain("blocked");
    expect(html).not.toContain("approval_status");
  });

  it("승인 완료(approved)는 확인할 사항 없음(ready)과 별도 줄로 표시한다", () => {
    const html = renderToStaticMarkup(<MultiPlatformReviewSummaryCard summary={makeSummary({ approved: 3 })} />);
    expect(html).toContain("승인 완료");
    expect(html).toContain("3개");
  });

  it("bulkApprovalEligiblePostIds가 비어 있으면 renderBulkApprovalAction을 호출하지 않는다", () => {
    let called = false;
    renderToStaticMarkup(
      <MultiPlatformReviewSummaryCard
        summary={makeSummary({ bulkApprovalEligiblePostIds: [] })}
        renderBulkApprovalAction={() => {
          called = true;
          return <button>승인</button>;
        }}
      />
    );
    expect(called).toBe(false);
  });

  it("bulkApprovalEligiblePostIds가 있으면 renderBulkApprovalAction을 그 목록과 함께 호출한다", () => {
    let receivedIds: readonly string[] = [];
    const html = renderToStaticMarkup(
      <MultiPlatformReviewSummaryCard
        summary={makeSummary({ bulkApprovalEligiblePostIds: ["a", "b"] })}
        renderBulkApprovalAction={(ids) => {
          receivedIds = ids;
          return <button>{ids.length}개 글 승인하기</button>;
        }}
      />
    );
    expect(receivedIds).toEqual(["a", "b"]);
    expect(html).toContain("2개 글 승인하기");
  });
});
