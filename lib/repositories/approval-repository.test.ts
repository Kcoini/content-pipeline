import { describe, expect, it } from "vitest";
import { mapApprovalLogRow } from "./approval-repository";
import type { ApprovalLogRow } from "@/lib/supabase/database.types";

function makeApprovalLogRow(overrides: Partial<ApprovalLogRow> = {}): ApprovalLogRow {
  return {
    id: "approval-1",
    theme_id: "theme-1",
    article_id: "article-1",
    target_type: "article",
    target_id: "article-1",
    action: "approve_article",
    approved_by: "local-user",
    status: "approved",
    notes: null,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("mapApprovalLogRow", () => {
  it("approval_logs row를 ApprovalLogEntry로 변환한다", () => {
    const row = makeApprovalLogRow();

    expect(mapApprovalLogRow(row)).toEqual({
      id: "approval-1",
      articleId: "article-1",
      themeId: "theme-1",
      targetType: "article",
      targetId: "article-1",
      action: "approve_article",
      status: "approved",
      approvedBy: "local-user",
      notes: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("target_type='article', target_id=article_id 로 매핑된다", () => {
    const row = makeApprovalLogRow({
      target_type: "article",
      target_id: "article-99",
      article_id: "article-99",
    });
    const entry = mapApprovalLogRow(row);

    expect(entry.targetType).toBe("article");
    expect(entry.targetId).toBe("article-99");
    expect(entry.targetId).toBe(entry.articleId);
  });

  it("target_type/target_id가 null이면 null을 그대로 반환한다", () => {
    const row = makeApprovalLogRow({ target_type: null, target_id: null });
    const entry = mapApprovalLogRow(row);

    expect(entry.targetType).toBeNull();
    expect(entry.targetId).toBeNull();
  });
});
