import { describe, expect, it } from "vitest";
import { mapApprovalLogRow } from "./approval-repository";
import type { ApprovalLogRow } from "@/lib/supabase/database.types";

function makeApprovalLogRow(overrides: Partial<ApprovalLogRow> = {}): ApprovalLogRow {
  return {
    id: "approval-1",
    theme_id: "theme-1",
    article_id: "article-1",
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
      action: "approve_article",
      status: "approved",
      approvedBy: "local-user",
      notes: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  });
});
