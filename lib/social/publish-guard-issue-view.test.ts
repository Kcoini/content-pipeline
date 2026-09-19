import { describe, expect, it } from "vitest";
import { describePublishGuardIssues } from "./publish-guard-issue-view";
import type { PlatformPublishGuardChecklistItem } from "./social-platform-types";

function checklistItem(
  key: string,
  status: PlatformPublishGuardChecklistItem["status"]
): PlatformPublishGuardChecklistItem {
  return { key, label: key, status, message: `${key} raw message(${status})` };
}

describe("describePublishGuardIssues", () => {
  it("checklist가 없으면 빈 배열을 반환한다", () => {
    expect(describePublishGuardIssues(undefined)).toEqual([]);
    expect(describePublishGuardIssues(null)).toEqual([]);
  });

  it("blocked 상태인 항목만 골라낸다", () => {
    const issues = describePublishGuardIssues([
      checklistItem("quality_status_ready", "pass"),
      checklistItem("approval_status_approved", "blocked"),
      checklistItem("content_present", "warning"),
      checklistItem("export_status_ready_or_exported", "blocked"),
    ]);

    expect(issues).toHaveLength(2);
    expect(issues.map((i) => i.key)).toEqual(["approval_status_approved", "export_status_ready_or_exported"]);
  });

  it("사용자에게 보이는 title/message에는 raw DB 필드명/원본 message가 노출되지 않는다(key는 React key 등 내부용이라 제외)", () => {
    const issues = describePublishGuardIssues([checklistItem("export_status_ready_or_exported", "blocked")]);

    const userFacingText = issues.map((i) => `${i.title} ${i.message ?? ""}`).join(" ");
    expect(userFacingText).not.toContain("export_status");
    expect(userFacingText).not.toContain("raw message");
  });

  it("알려진 key는 자연어 title/message를 갖는다", () => {
    const issues = describePublishGuardIssues([checklistItem("approval_status_approved", "blocked")]);

    expect(issues[0].title).toBe("아직 승인되지 않았습니다.");
    expect(issues[0].message).toContain("검토·승인");
  });

  it("사전에 없는 key도 기본 안내 문구로 안전하게 처리한다(raw key 노출 없음)", () => {
    const issues = describePublishGuardIssues([checklistItem("brand_new_future_rule", "blocked")]);

    expect(issues[0].title).toBe("게시 전에 확인이 필요한 항목이 있습니다.");
  });
});
