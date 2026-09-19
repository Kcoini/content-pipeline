import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PublishPreparationSummaryCard } from "./publish-preparation-summary-card";
import type { MultiPlatformPublishPreparationSummary } from "@/lib/ui/multi-platform-publish-preparation-summary";

function makeSummary(overrides: Partial<MultiPlatformPublishPreparationSummary> = {}): MultiPlatformPublishPreparationSummary {
  return {
    total: 6,
    notApproved: 0,
    needsAttention: 0,
    needsSetup: 0,
    ready: 4,
    inProgress: 0,
    completed: 2,
    failed: 0,
    postIdsByState: { not_approved: [], needs_attention: [], needs_setup: [], ready: [], in_progress: [], completed: [], failed: [] },
    ...overrides,
  };
}

describe("PublishPreparationSummaryCard (Phase UX-05A)", () => {
  it("전체/게시 준비 완료/완료 개수를 사용자 문구로 보여준다", () => {
    const html = renderToStaticMarkup(<PublishPreparationSummaryCard summary={makeSummary()} />);
    expect(html).toContain("전체");
    expect(html).toContain("6개");
    expect(html).toContain("게시 준비 완료");
    expect(html).toContain("완료");
  });

  it("0개인 카테고리는 표시하지 않는다", () => {
    const html = renderToStaticMarkup(<PublishPreparationSummaryCard summary={makeSummary()} />);
    expect(html).not.toContain("처리 실패");
    expect(html).not.toContain("게시 설정 필요");
    expect(html).not.toContain("승인 필요");
  });

  it("raw state/status를 그대로 노출하지 않는다", () => {
    const html = renderToStaticMarkup(<PublishPreparationSummaryCard summary={makeSummary({ failed: 1, needsSetup: 1, notApproved: 1 })} />);
    expect(html).not.toContain("not_approved");
    expect(html).not.toContain("needs_setup");
    expect(html).not.toContain("publish_status");
    expect(html).not.toContain("approval_status");
  });
});
